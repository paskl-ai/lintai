from __future__ import annotations
from pathlib import Path
from datetime import datetime, UTC
import json, logging, subprocess, tempfile, uuid
from enum import Enum
from typing import Any, Optional, Literal

from fastapi import (
    FastAPI,
    BackgroundTasks,
    UploadFile,
    Query,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ── logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── storage paths ──────────────────────────────────────────────────────────
DATA_DIR = Path(tempfile.gettempdir()) / "lintai-ui"
DATA_DIR.mkdir(exist_ok=True)
CONFIG_FILE = DATA_DIR / "config.json"


def _run_index() -> Path:
    return DATA_DIR / "runs.json"


def _load_runs():
    return _load_json(_run_index(), [])


def _save_runs(runs):
    _run_index().write_text(json.dumps(runs, indent=2))


def _load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default


# ── pydantic models (show up in Swagger) ───────────────────────────────────
class RunType(str, Enum):
    scan = "scan"
    inventory = "inventory"


class ConfigModel(BaseModel):
    """Configuration persisted between sessions."""

    source_path: str = Field(..., description="Default folder to analyse")
    ai_call_depth: int = Field(2, ge=0, le=10)
    ruleset: Optional[str] = None


class RunSummary(BaseModel):
    run_id: str
    type: RunType
    created: datetime
    status: str  # pending | done | error
    path: str


class ScanReport(BaseModel):
    type: Literal["scan"]
    data: dict[str, Any]  # {"llm_usage":…, "findings":[…]}


class InventoryReport(BaseModel):
    type: Literal["inventory"]
    data: dict[str, Any]  # {"nodes":[…], "edges":[…]}


# ── FastAPI setup ──────────────────────────────────────────────────────────
app = FastAPI(title="Lintai UI", docs_url="/api/docs", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ────────────────────────────────────────────────────────────────
def _register_run(run_id: str, run_type: RunType, path: str):
    runs = _load_runs()
    runs.append(
        {
            "run_id": run_id,
            "type": run_type,
            "created": datetime.now(UTC).isoformat(),  # <-- serialisable str
            "status": "pending",
            "path": path,
        }
    )
    _save_runs(runs)


def _update_run_status(run_id: str, status: str):
    runs = _load_runs()
    for r in runs:
        if r["run_id"] == run_id:
            r["status"] = status
            break
    _save_runs(runs)


def _kick_off_lintai(
    tasks: BackgroundTasks, run_id: str, cmd: list[str], out_file: Path
):
    def _run():
        try:
            subprocess.run(cmd, check=True)
            _update_run_status(run_id, "done")
        except subprocess.CalledProcessError as exc:
            logger.error("lintai command failed: %s", exc)
            _update_run_status(run_id, "error")

    tasks.add_task(_run)


# ── API endpoints ──────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ------------------------------------------------------------------ config
@app.get("/api/config", response_model=ConfigModel)
def get_config():
    return _load_json(CONFIG_FILE, ConfigModel(source_path=".").model_dump())


@app.post("/api/config", response_model=ConfigModel)
def set_config(cfg: ConfigModel):
    CONFIG_FILE.write_text(cfg.model_dump_json(indent=2))
    return cfg


# ------------------------------------------------------------------ runs index
@app.get("/api/runs", response_model=list[RunSummary])
def list_runs():
    return _load_runs()


# ------------------------------------------------------------------ scan
@app.post("/api/scan", response_model=RunSummary)
async def run_scan(
    files: list[UploadFile],
    tasks: BackgroundTasks,
    depth: int = Query(2, description="ai_call_depth override"),
):
    run_id = str(uuid.uuid4())
    workdir = DATA_DIR / run_id
    workdir.mkdir()

    # save uploads
    for f in files:
        (workdir / f.filename).write_bytes(await f.read())

    out_json = workdir / "scan_report.json"
    cmd = ["lintai", "scan", str(workdir), "--output", str(out_json), "-d", str(depth)]
    _register_run(run_id, RunType.scan, str(workdir))
    _kick_off_lintai(tasks, run_id, cmd, out_json)
    return RunSummary(
        run_id=run_id,
        type=RunType.scan,
        created=datetime.now(UTC),
        status="pending",
        path=str(workdir),
    )


# ------------------------------------------------------------------ inventory
@app.post("/api/inventory", response_model=RunSummary)
def run_inventory(
    path: str = Query(..., description="Path to analyse"),
    tasks: BackgroundTasks = None,
    depth: int = Query(2, description="ai_call_depth override"),
):
    run_id = str(uuid.uuid4())
    out_json = DATA_DIR / f"{run_id}_inventory.json"
    cmd = ["lintai", "ai-inventory", path, "--output", str(out_json), "-d", str(depth)]
    _register_run(run_id, RunType.inventory, path)
    _kick_off_lintai(tasks, run_id, cmd, out_json)
    return RunSummary(
        run_id=run_id,
        type=RunType.inventory,
        created=datetime.now(UTC),
        status="pending",
        path=path,
    )


# ------------------------------------------------------------------ results
@app.get(
    "/api/results/{run_id}",
    responses={
        200: {"content": {"application/json": {}}},
        404: {"model": None},
    },
)
def get_results(run_id: str):
    runs = _load_runs()
    meta = next((r for r in runs if r["run_id"] == run_id), None)
    if not meta:
        raise HTTPException(404, "run_id not found")

    if meta["type"] == RunType.scan:
        file = DATA_DIR / run_id / "scan_report.json"
    else:
        file = DATA_DIR / f"{run_id}_inventory.json"

    if not file.exists():
        return {"status": "pending"}

    return json.loads(file.read_text())


# ---------------------------------------------------- scan filtering helper
@app.get("/api/results/{run_id}/filter")
def filter_findings(
    run_id: str,
    severity: Optional[str] = None,
    owasp: Optional[str] = None,
    component: Optional[str] = None,
):
    res = get_results(run_id)
    if res.get("status") == "pending":
        return res
    if res.get("type") != "scan":
        raise HTTPException(400, "Filtering only supported for scan results")

    findings = res["data"]["findings"]
    if severity:
        findings = [f for f in findings if f["severity"] == severity]
    if owasp:
        findings = [f for f in findings if owasp in f.get("owasp_id", "")]
    if component:
        findings = [f for f in findings if component in f.get("location", "")]

    res["data"]["findings"] = findings
    return res


# ---------------------------------------------------- inventory subgraph
@app.get("/api/inventory/{run_id}/subgraph")
def subgraph(
    run_id: str,
    node: str,
    depth: int = Query(1, ge=1, le=5),
):
    res = get_results(run_id)
    if res.get("status") == "pending":
        return res
    if res.get("type") != "inventory":
        raise HTTPException(400, "subgraph only supported for inventory runs")

    # naïve exploration – shrink to neighbours within depth
    nodes = res["data"]["nodes"]
    edges = res["data"]["edges"]
    frontier = {node}
    keep = set(frontier)
    for _ in range(depth):
        frontier = {
            e["source"] if e["target"] in frontier else e["target"]
            for e in edges
            if e["source"] in frontier or e["target"] in frontier
        }
        keep.update(frontier)

    sub_nodes = [n for n in nodes if n["id"] in keep]
    sub_edges = [e for e in edges if e["source"] in keep and e["target"] in keep]
    return {"nodes": sub_nodes, "edges": sub_edges}


# ------------------------------------------------------------------ static frontend
frontend_dir = Path(__file__).parent / "frontend" / "dist"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    logger.warning("Frontend build not found at %s (UI disabled)", frontend_dir)
