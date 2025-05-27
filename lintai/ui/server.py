"""
lintai/ui/server.py – FastAPI backend for the React/Cytoscape UI
----------------------------------------------------------------
Endpoints
*  GET  /api/health
*  GET /POST  /api/config      – UI defaults (path, depth, log-level …)
*  GET /POST  /api/env         – non-secret .env knobs (budgets, provider …)
*  POST       /api/secrets     – write-only API keys
*  POST       /api/scan        – run detectors in background
*  POST       /api/inventory   – run ai-inventory in background
*  GET        /api/runs        – history
*  GET        /api/results/{id}[ /filter ]   – reports & helpers
"""

from __future__ import annotations

import json, logging, subprocess, tempfile, uuid
from datetime import datetime, UTC
from enum import Enum
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import (
    FastAPI,
    BackgroundTasks,
    UploadFile,
    HTTPException,
    Body,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

# ─────────────────────────── logging ────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

# ────────────────── persistent workspace ────────────────────
DATA_DIR = Path(tempfile.gettempdir()) / "lintai-ui"
DATA_DIR.mkdir(exist_ok=True)

RUNS_FILE = DATA_DIR / "runs.json"
CONFIG_JSON = DATA_DIR / "config.json"  # *UI* prefs (depth, log-level …)
CFG_ENV = DATA_DIR / "config.env"  # non-secret
SECR_ENV = DATA_DIR / "secrets.env"  # API keys (0600)


# ──────────────────────── Pydantic models ─────────────────────
class ConfigModel(BaseModel):
    """Preferences shown in the UI (mirrors CLI flags)."""

    source_path: str = Field(".", description="default path")
    ai_call_depth: int = Field(2, ge=0, description="--ai-call-depth")
    log_level: str = Field("INFO", description="--log-level")
    ruleset: str | None = Field(None)
    env_file: str | None = Field(None, description="external .env file")


class RunType(str, Enum):
    scan = "scan"
    inventory = "inventory"


class RunSummary(BaseModel):
    run_id: str
    type: RunType
    created: datetime
    status: Literal["pending", "done", "error"]
    path: str


class SecretPayload(BaseModel):
    """Write-only keys.  None entries are ignored."""

    OPENAI_API_KEY: str | None = None
    AZURE_OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None
    COHERE_API_KEY: str | None = None


class EnvPayload(BaseModel):
    """Non-secret .env options."""

    LINTAI_MAX_LLM_TOKENS: int | None = None
    LINTAI_MAX_LLM_COST_USD: float | None = None
    LINTAI_MAX_LLM_REQUESTS: int | None = None
    LINTAI_LLM_PROVIDER: str | None = None
    OPENAI_MODEL: str | None = None
    # ⇢ add more knobs as needed

    @field_validator("*", mode="before")
    def _stringify(cls, v):  # store all values as str inside .env
        return None if v is None else str(v)


# ─────────────────── tiny helpers ───────────────────────────
def _json_load(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def _json_dump(path: Path, obj: Any):
    path.write_text(
        json.dumps(
            obj,
            indent=2,
            default=lambda o: o.isoformat() if isinstance(o, datetime) else TypeError(),
        )
    )


def _write_env(path: Path, mapping: dict[str, str]):
    text = "\n".join(f"{k}={v}" for k, v in mapping.items() if v is not None)
    path.write_text(text)
    path.chmod(0o600)


#  config helpers ----------------------------------------------------------
def _load_cfg() -> ConfigModel:
    return (
        ConfigModel.model_validate_json(CONFIG_JSON.read_text())
        if CONFIG_JSON.exists()
        else ConfigModel()
    )


def _save_cfg(cfg: ConfigModel):
    CONFIG_JSON.write_text(cfg.model_dump_json(indent=2))


#  run-index helpers -------------------------------------------------------
def _runs() -> list[RunSummary]:
    return [RunSummary.model_validate(r) for r in _json_load(RUNS_FILE, [])]


def _save_runs(lst: list[RunSummary]):
    _json_dump(RUNS_FILE, [r.model_dump() for r in lst])


def _add_run(r: RunSummary):
    lst = _runs()
    lst.append(r)
    _save_runs(lst)


def _set_status(rid: str, st: Literal["done", "error"]):
    lst = _runs()
    for r in lst:
        if r.run_id == rid:
            r.status = st
            break
    _save_runs(lst)


#  helpers: choose which .env to hand to the CLI ---------------------------
def _env_cli_flags(extra_env: str | None = None) -> list[str]:
    if extra_env:
        return ["-e", extra_env]
    if SECR_ENV.exists():
        return ["-e", str(SECR_ENV)]
    if CFG_ENV.exists():
        return ["-e", str(CFG_ENV)]
    return []


#  helpers: build common flags (depth / log) -------------------------------
def _common_flags(depth: int | None, log_level: str | None):
    pref = _load_cfg()
    return (
        ["-d", str(depth or pref.ai_call_depth), "-l", log_level or pref.log_level]
        + ([] if pref.ruleset is None else ["-r", pref.ruleset])
        + ([] if pref.env_file is None else ["-e", pref.env_file])
    )


#  helpers: background job wrapper ----------------------------------------
def _kick(cmd: list[str], rid: str, bg: BackgroundTasks):
    def task():
        try:
            subprocess.run(cmd, check=True)
            _set_status(rid, "done")
        except subprocess.CalledProcessError as exc:
            log.error("lintai failed: %s", exc)
            _set_status(rid, "error")

    bg.add_task(task)


def _report_path(rid: str, kind: RunType) -> Path:
    return (
        (DATA_DIR / rid / "scan_report.json")
        if kind is RunType.scan
        else (DATA_DIR / f"{rid}_inventory.json")
    )


# ╭──────────────────────── FastAPI app ─────────────────────╮
app = FastAPI(title="Lintai UI", docs_url="/api/docs", redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────── health ───────────
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ─────────── config (JSON) ─────
@app.get("/api/config", response_model=ConfigModel)
def cfg_get():
    return _load_cfg()


@app.post("/api/config", response_model=ConfigModel)
def cfg_set(cfg: ConfigModel):
    _save_cfg(cfg)
    return cfg


# ─────────── env (non-secret) ──
@app.get("/api/env", response_model=EnvPayload)
def env_get():
    data: dict[str, str] = {}
    if CFG_ENV.exists():
        for ln in CFG_ENV.read_text().splitlines():
            if ln and not ln.startswith("#") and "=" in ln:
                k, v = ln.split("=", 1)
                data[k] = v
    # scrub any secret keys users might have pasted here by mistake
    for k in SecretPayload.model_fields:
        data.pop(k, None)
    return EnvPayload(**data)


@app.post("/api/env", status_code=204)
def env_set(payload: EnvPayload = Body(...)):
    _write_env(CFG_ENV, payload.model_dump(exclude_none=True))


# ─────────── secrets (write-only) ─────
@app.post("/api/secrets", status_code=204)
def secrets_set(payload: SecretPayload = Body(...)):
    _write_env(SECR_ENV, payload.model_dump(exclude_none=True))


# ─────────── /runs ─────────────
@app.get("/api/runs", response_model=list[RunSummary])
def runs():
    return _runs()


# ─────────── /scan ─────────────
@app.post("/api/scan", response_model=RunSummary)
async def scan(
    bg: BackgroundTasks,
    files: list[UploadFile] = [],
    path: str | None = None,
    depth: int | None = None,
    log_level: str | None = None,
):
    rid = str(uuid.uuid4())
    work = DATA_DIR / rid
    work.mkdir()

    for up in files:
        (work / up.filename).write_bytes(await up.read())

    target = str(work if files else (path or _load_cfg().source_path))
    out = _report_path(rid, RunType.scan)

    cmd = (
        ["lintai", "scan", target, "--output", str(out)]
        + _common_flags(depth, log_level)
        + _env_cli_flags()
    )
    _kick(cmd, rid, bg)

    run = RunSummary(
        run_id=rid,
        type=RunType.scan,
        created=datetime.now(UTC),
        status="pending",
        path=target,
    )
    _add_run(run)
    return run


# ─────────── /inventory ────────
@app.post("/api/inventory", response_model=RunSummary)
def inventory(
    bg: BackgroundTasks,
    path: str | None = None,
    depth: int | None = None,
    log_level: str | None = None,
):
    rid = str(uuid.uuid4())
    out = _report_path(rid, RunType.inventory)

    cmd = (
        [
            "lintai",
            "ai-inventory",
            path or _load_cfg().source_path,
            "--graph",  # always ask for graph for the UI
            "--output",
            str(out),
        ]
        + _common_flags(depth, log_level)
        + _env_cli_flags()
    )
    _kick(cmd, rid, bg)

    run = RunSummary(
        run_id=rid,
        type=RunType.inventory,
        created=datetime.now(UTC),
        status="pending",
        path=path or _load_cfg().source_path,
    )
    _add_run(run)
    return run


# ─────────── /results/{id} ─────
@app.get(
    "/api/results/{rid}",
    responses={200: {"content": {"application/json": {}}}, 404: {}},
)
def results(rid: str):
    run = next((r for r in _runs() if r.run_id == rid), None)
    if not run:
        raise HTTPException(404)
    fp = _report_path(rid, run.type)
    return {"status": "pending"} if not fp.exists() else json.loads(fp.read_text())


# ---- findings filter helper
@app.get("/api/results/{rid}/filter")
def filter_scan(
    rid: str,
    severity: str | None = None,
    owasp_id: str | None = None,
    component: str | None = None,
):
    data = results(rid)
    if data.get("status") == "pending":
        return data
    if data["type"] != "scan":
        raise HTTPException(400, "not a scan run")

    findings = data["data"]["findings"]
    if severity:
        findings = [f for f in findings if f["severity"] == severity]
    if owasp_id:
        findings = [f for f in findings if owasp_id in f.get("owasp_id", "")]
    if component:
        findings = [f for f in findings if component in f.get("location", "")]

    data["data"]["findings"] = findings
    return data


# ---- inventory sub-graph helper
@app.get("/api/inventory/{rid}/subgraph")
def subgraph(rid: str, node: str, depth: int = Query(1, ge=1, le=5)):
    data = results(rid)
    if data.get("status") == "pending":
        return data
    if data["type"] != "inventory":
        raise HTTPException(400, "not an inventory run")

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


# ─────────── static React bundle ──────────
frontend = Path(__file__).parent / "frontend" / "dist"
if frontend.exists():
    app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
else:
    log.warning("UI disabled – React build not found at %s", frontend)
