# lintai/ui/server.py
from __future__ import annotations

import json, logging, subprocess, tempfile, uuid
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Literal, TypedDict

from fastapi import (
    BackgroundTasks,
    FastAPI,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ───────────────────────── logging ──────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ──────────────────── persistent folders ────────────────────
DATA_DIR = Path(tempfile.gettempdir()) / "lintai-ui"
DATA_DIR.mkdir(exist_ok=True)

CONFIG_FILE = DATA_DIR / "config.json"
RUNS_FILE = DATA_DIR / "runs.json"


# ──────────────────────── Pydantic models ───────────────────
class ConfigModel(BaseModel):
    """Values mirror the flags of the CLI so we can pass-through 1-to-1."""

    source_path: str = Field(".", description="Default path to analyse")
    ai_call_depth: int = Field(2, ge=0, description="--ai-call-depth")
    log_level: str = Field("INFO", description="--log-level")
    ruleset: Optional[str] | None = Field(None, description="--ruleset")
    env_file: Optional[str] | None = Field(None, description="--env-file")


class RunType(str, Enum):
    scan = "scan"
    inventory = "inventory"


class RunSummary(BaseModel):
    run_id: str
    type: RunType
    created: datetime
    status: Literal["pending", "done", "error"]
    path: str


class ScanReport(BaseModel):
    type: Literal["scan"]
    data: dict[str, Any]


class InventoryReport(BaseModel):
    type: Literal["inventory"]
    data: dict[str, Any]


# ───────────────────── helper functions ─────────────────────
def _run_index() -> Path:
    return RUNS_FILE


def _read_json(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def _write_json(path: Path, obj: Any):
    # make sure datetimes are serialisable
    def _default(o):
        return o.isoformat() if isinstance(o, datetime) else TypeError()

    path.write_text(json.dumps(obj, indent=2, default=_default))


# config helpers
def _load_config() -> ConfigModel:
    return ConfigModel.model_validate(_read_json(CONFIG_FILE, {}))


def _save_config(cfg: ConfigModel):
    _write_json(CONFIG_FILE, cfg.model_dump())


# run-index helpers
def _load_runs() -> list[RunSummary]:
    raw = _read_json(RUNS_FILE, [])
    return [RunSummary.model_validate(r) for r in raw]


def _save_runs(runs: list[RunSummary]):
    _write_json(RUNS_FILE, [r.model_dump() for r in runs])


def _register_run(run: RunSummary):
    runs = _load_runs()
    runs.append(run)
    _save_runs(runs)


def _update_status(run_id: str, new_status: Literal["done", "error"]):
    runs = _load_runs()
    for r in runs:
        if r.run_id == run_id:
            r.status = new_status
            break
    _save_runs(runs)


# argv builder (merges stored-config with overrides)
def _cli_args(
    path: str | None, depth: int | None, log: str | None, cfg: ConfigModel
) -> list[str]:
    return [
        "-d",
        str(depth if depth is not None else cfg.ai_call_depth),
        "-l",
        log if log is not None else cfg.log_level,
        *([] if cfg.ruleset is None else ["-r", cfg.ruleset]),
        *([] if cfg.env_file is None else ["-e", cfg.env_file]),
    ] + ([path] if path else [cfg.source_path])


# ───────────────────────── FastAPI app ──────────────────────
app = FastAPI(title="Lintai UI", docs_url="/api/docs", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────── health / config ───────────────────
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/config", response_model=ConfigModel)
def get_cfg():
    return _load_config()


@app.post("/api/config", response_model=ConfigModel)
def set_cfg(cfg: ConfigModel):
    _save_config(cfg)
    return cfg


# ───────────────────────── runs index ───────────────────────
@app.get("/api/runs", response_model=list[RunSummary])
def runs():
    return _load_runs()


# ─────────────────────────── /scan ──────────────────────────
@app.post("/api/scan", response_model=RunSummary)
async def scan(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = [],
    path: str | None = Query(None),
    depth: int | None = Query(None, ge=0),
    log_level: str | None = Query(None),
):
    cfg = _load_config()
    run_id = str(uuid.uuid4())
    work = DATA_DIR / run_id
    work.mkdir()

    # store uploaded sources (optional workflow)
    for up in files:
        (work / up.filename).write_bytes(await up.read())
    scan_target = str(work if files else (path or cfg.source_path))

    out_json = work / "scan_report.json"
    cmd = ["lintai", "scan", scan_target, "--output", str(out_json)] + _cli_args(
        path=None, depth=depth, log=log_level, cfg=cfg
    )

    # async execution
    def _job():
        try:
            subprocess.run(cmd, check=True)
            _update_status(run_id, "done")
        except subprocess.CalledProcessError as exc:
            logger.error("scan failed: %s", exc)
            _update_status(run_id, "error")

    background_tasks.add_task(_job)

    summary = RunSummary(
        run_id=run_id,
        type=RunType.scan,
        created=datetime.now(UTC),
        status="pending",
        path=scan_target,
    )
    _register_run(summary)
    return summary


# ──────────────────────── /inventory ────────────────────────
@app.post("/api/inventory", response_model=RunSummary)
def inventory(
    background_tasks: BackgroundTasks,
    path: str | None = Query(None),
    depth: int | None = Query(None, ge=0),
    log_level: str | None = Query(None),
):
    cfg = _load_config()
    run_id = str(uuid.uuid4())
    out_json = DATA_DIR / f"{run_id}_inventory.json"

    cmd = [
        "lintai",
        "ai-inventory",
        path or cfg.source_path,
        "--output",
        str(out_json),
    ] + _cli_args(None, depth, log_level, cfg)

    def _job():
        try:
            subprocess.run(cmd, check=True)
            _update_status(run_id, "done")
        except subprocess.CalledProcessError as exc:
            logger.error("inventory failed: %s", exc)
            _update_status(run_id, "error")

    background_tasks.add_task(_job)

    summary = RunSummary(
        run_id=run_id,
        type=RunType.inventory,
        created=datetime.now(UTC),
        status="pending",
        path=path or cfg.source_path,
    )
    _register_run(summary)
    return summary


# ──────────────────────── /results/{id} ─────────────────────
@app.get(
    "/api/results/{run_id}",
    responses={200: {"content": {"application/json": {}}}, 404: {}},
)
def results(run_id: str):
    run = next((r for r in _load_runs() if r.run_id == run_id), None)
    if not run:
        raise HTTPException(404, "run_id not found")

    if run.type is RunType.scan:
        file = DATA_DIR / run_id / "scan_report.json"
    else:
        file = DATA_DIR / f"{run_id}_inventory.json"

    return {"status": "pending"} if not file.exists() else json.loads(file.read_text())


# ───────────────────── finding filter helper ───────────────
@app.get("/api/results/{run_id}/filter")
def filter_scan(
    run_id: str,
    severity: str | None = None,
    owasp_id: str | None = None,
    component: str | None = None,
):
    data = results(run_id)
    if data.get("status") == "pending":
        return data
    if data["type"] != "scan":
        raise HTTPException(400, "Not a scan run")

    findings = data["data"]["findings"]
    if severity:
        findings = [f for f in findings if f["severity"] == severity]
    if owasp_id:
        findings = [f for f in findings if owasp_id in f.get("owasp_id", "")]
    if component:
        findings = [f for f in findings if component in f.get("location", "")]

    data["data"]["findings"] = findings
    return data


# ─────────────────── inventory sub-graph helper ─────────────
@app.get("/api/inventory/{run_id}/subgraph")
def subgraph(run_id: str, node: str, depth: int = Query(1, ge=1, le=5)):
    data = results(run_id)
    if data.get("status") == "pending":
        return data
    if data["type"] != "inventory":
        raise HTTPException(400, "Not an inventory run")

    nodes, edges = data["data"]["nodes"], data["data"]["edges"]
    frontier = {node}
    keep = set(frontier)
    for _ in range(depth):
        frontier = {
            e["source"] if e["target"] in frontier else e["target"]
            for e in edges
            if e["source"] in frontier or e["target"] in frontier
        }
        keep |= frontier

    return {
        "nodes": [n for n in nodes if n["id"] in keep],
        "edges": [e for e in edges if e["source"] in keep and e["target"] in keep],
    }


# ─────────────────── embed built React bundle ───────────────
frontend = Path(__file__).parent / "frontend" / "dist"
if frontend.exists():
    app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
else:
    logger.warning("UI disabled – `%s` not found", frontend)
