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
*  GET        /api/last-result – fetch the most recent run result
*  GET        /api/history     – fetch the history of all scan runs
"""

from __future__ import annotations

import os, json, logging, subprocess, tempfile, uuid
from datetime import datetime, timezone  # Replace UTC with timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import (
    FastAPI,
    File,
    Form,
    BackgroundTasks,
    UploadFile,
    HTTPException,
    Body,
    Query,
    Depends,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

# ─────────────────────────── logging ────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name%s: %(message)s",
)
log = logging.getLogger(__name__)


def set_server_log_level(level: str) -> None:
    """Set the log level for the server logger."""
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logging.getLogger().setLevel(numeric_level)
    log.setLevel(numeric_level)


# ──────────────────── workspace root ──────────────────────────
ROOT = Path(os.getenv("LINTAI_SRC_CODE_ROOT", Path.cwd()))
if not ROOT.is_dir():
    raise RuntimeError(f"Workspace root {ROOT} does not exist or is not a directory")
# ────────────────── persistent workspace ────────────────────
# Use persistent directory in user's home instead of temp to survive reboots
DATA_DIR = Path.home() / ".lintai" / "ui"
DATA_DIR.mkdir(parents=True, exist_ok=True)

RUNS_FILE = DATA_DIR / "runs.json"
SCAN_HISTORY_FILE = (
    DATA_DIR / "scan_history.json"
)  # Enhanced scan history with file details
INVENTORY_HISTORY_FILE = (
    DATA_DIR / "inventory_history.json"
)  # Enhanced inventory history with file details
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

    LLM_API_KEY: str | None = None
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
    LLM_ENDPOINT_URL: str | None = None
    LLM_API_VERSION: str | None = None
    LLM_MODEL_NAME: str | None = None
    # ⇢ add more knobs as needed

    @field_validator("*", mode="before")
    def _stringify(cls, v):  # store all values as str inside .env
        return None if v is None else str(v)


# ─────────────────── tiny helpers ───────────────────────────


def _safe(path: str) -> Path:
    p = (ROOT / Path(path).expanduser()).resolve()
    if not p.is_relative_to(ROOT):
        raise HTTPException(403, f"Can't go outside workspace {ROOT}")
    return p


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
    # accept either RunSummary objects or plain dicts
    serialised: list[dict] = []
    for r in lst:
        serialised.append(r.model_dump() if isinstance(r, RunSummary) else r)
    _json_dump(RUNS_FILE, serialised)


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
    """Determine which env file to use, prioritizing user-specified files."""
    # 1. If an extra env file is explicitly provided, use that
    if extra_env:
        return ["-e", extra_env]

    # 2. Check if user has configured a custom env file in the UI
    pref = _load_cfg()
    if pref.env_file:
        return ["-e", pref.env_file]

    # 3. Use server's internal config files - need to merge secrets and config
    env_files = []

    # Always include secrets if it exists (API keys)
    if SECR_ENV.exists():
        env_files.extend(["-e", str(SECR_ENV)])

    # Also include config environment if it exists (other settings)
    if CFG_ENV.exists():
        env_files.extend(["-e", str(CFG_ENV)])

    if env_files:
        return env_files

    # 4. No env file specified - CLI will auto-load .env from working directory
    return []


#  helpers: build common flags (depth / log) -------------------------------
def _common_flags(depth: int | None, log_level: str | None):
    pref = _load_cfg()
    return (
        ["-d", str(depth or pref.ai_call_depth), "-l", log_level or pref.log_level]
        + ([] if pref.ruleset is None else ["-r", pref.ruleset])
        # Note: env_file is now handled by _env_cli_flags() to avoid conflicts
    )


#  helpers: background job wrapper ----------------------------------------
def _kick(cmd: list[str], rid: str, bg: BackgroundTasks):
    def task():
        try:
            # Run the command and capture the exit code
            result = subprocess.run(cmd, check=False)

            # Exit codes 0 and 1 are both considered successful for lintai:
            # - 0: scan completed with no blocking findings
            # - 1: scan completed with blocking findings (still a successful scan)
            # Only exit codes > 1 indicate actual errors
            if result.returncode <= 1:
                _set_status(rid, "done")

                # Add to enhanced history when job completes successfully
                run = next((r for r in _runs() if r.run_id == rid), None)
                if run:
                    report_path = _report_path(rid, run.type)
                    report = None
                    if report_path.exists():
                        try:
                            report = json.loads(report_path.read_text())
                        except Exception:
                            pass

                    if run.type == RunType.scan:
                        _add_scan_history_entry(run, report)
                    elif run.type == RunType.inventory:
                        _add_inventory_history_entry(run, report)
            else:
                # Only treat exit codes > 1 as actual errors
                log.error("lintai failed with exit code %d", result.returncode)
                _set_status(rid, "error")

                # Store error message for failed scans
                run = next((r for r in _runs() if r.run_id == rid), None)
                if run:
                    error_report = {
                        "error": True,
                        "error_message": f"Command failed with exit code {result.returncode}",
                        "errors": [
                            f"Command failed with exit code {result.returncode}"
                        ],
                    }
                    error_path = _report_path(rid, run.type)
                    error_path.write_text(json.dumps(error_report))

                    # Add to history with error info
                    if run.type == RunType.scan:
                        _add_scan_history_entry(run, error_report)
                    elif run.type == RunType.inventory:
                        _add_inventory_history_entry(run, error_report)

        except Exception as exc:
            # Handle any other exceptions (e.g., file not found, permission errors)
            log.error("lintai execution failed: %s", exc)
            _set_status(rid, "error")

            # Store error message for failed scans
            run = next((r for r in _runs() if r.run_id == rid), None)
            if run:
                error_report = {
                    "error": True,
                    "error_message": str(exc),
                    "errors": [str(exc)],
                }
                error_path = _report_path(rid, run.type)
                error_path.write_text(json.dumps(error_report))

                # Add to history with error info
                if run.type == RunType.scan:
                    _add_scan_history_entry(run, error_report)
                elif run.type == RunType.inventory:
                    _add_inventory_history_entry(run, error_report)

    bg.add_task(task)


def _report_path(rid: str, kind: RunType) -> Path:
    # Always use a subdirectory for both scan and inventory
    subdir = DATA_DIR / rid
    subdir.mkdir(parents=True, exist_ok=True)
    if kind is RunType.scan:
        return subdir / "scan_report.json"
    else:
        return subdir / "inventory.json"


# ╭──────────────────────── FastAPI app ─────────────────────╮
app = FastAPI(title="Lintai UI", docs_url="/api/docs", redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────── health ───────────
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ─────────── file system ──────
@app.get("/api/fs")
def list_dir(path: str | None = None):
    """
    List files in a directory, relative to the workspace root.
    If no path is given, lists the workspace root.
    """
    p = _safe(path or ROOT)
    if not p.is_dir():
        raise HTTPException(400, "not a directory")
    items = [
        {
            "name": f.name,
            "path": str(p / f.name).removeprefix(str(ROOT) + "/"),
            "dir": f.is_dir(),
        }
        for f in sorted(p.iterdir())
        if not f.name.startswith(".")  # ignore dotfiles
    ]
    return {
        "cwd": "" if p == ROOT else str(p.relative_to(ROOT)),
        "items": items,
    }


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


@app.get("/api/secrets/status")
def secrets_status():
    """Return which API keys are configured (without revealing the actual keys)"""
    if not SECR_ENV.exists():
        return {}

    try:
        with open(SECR_ENV, "r") as f:
            lines = f.readlines()

        configured_keys = {}
        for line in lines:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key = line.split("=")[0].strip()
                # Return True if the key exists and has a non-empty value
                value = line.split("=", 1)[1].strip()
                configured_keys[key] = bool(value)

        return configured_keys
    except Exception:
        return {}


# ─────────── clear all history ─────
@app.delete("/api/history/clear", status_code=204)
def clear_all_history():
    """
    Clear all scan/inventory history and results while preserving user config and secrets.
    This removes:
    - runs.json (run history)
    - scan_history.json (scan history)
    - inventory_history.json (inventory history)
    - file_index.json (file index)
    - All individual result directories (UUID folders)

    Preserves:
    - config.env (user configuration)
    - secrets.env (API keys)
    """
    import shutil

    try:
        # Remove history files
        for file_path in [RUNS_FILE, SCAN_HISTORY_FILE, INVENTORY_HISTORY_FILE]:
            if file_path.exists():
                file_path.unlink()
                log.info(f"Removed {file_path}")

        # Remove file index if it exists
        file_index_path = DATA_DIR / "file_index.json"
        if file_index_path.exists():
            file_index_path.unlink()
            log.info(f"Removed {file_index_path}")

        # Remove all UUID result directories
        for item in DATA_DIR.iterdir():
            if item.is_dir() and len(item.name) == 36:  # UUID length check
                try:
                    # Validate it's actually a UUID format
                    uuid.UUID(item.name)
                    shutil.rmtree(item)
                    log.info(f"Removed result directory {item}")
                except (ValueError, OSError) as e:
                    log.warning(f"Failed to remove directory {item}: {e}")

        log.info("Successfully cleared all history and results")

    except Exception as e:
        log.error(f"Error clearing history: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to clear history: {str(e)}"
        )


# ─────────── /runs ─────────────
@app.get("/api/runs", response_model=list[RunSummary])
def runs():
    return _runs()


# ─────────── /last-result ──────
@app.get("/api/last-result")
def last_result():
    """
    Fetch the most recent run result along with its report if available.
    """
    runs = _runs()
    if not runs:
        return {"run": None, "report": None}
    latest_run = max(runs, key=lambda r: r.created)
    report_path = _report_path(latest_run.run_id, latest_run.type)
    report = None
    if report_path.exists():
        report = json.loads(report_path.read_text())
    return {"run": latest_run, "report": report}


# ─────────── /last-result/{run_type} ──────
@app.get("/api/last-result/{run_type}")
def last_result_by_type(run_type: str):
    """
    Fetch the most recent run result of a specific type (scan or inventory)
    along with its report if available.
    """
    runs = _runs()
    if not runs:
        return {"run": None, "report": None}

    # Filter runs by type
    filtered_runs = [r for r in runs if r.type == run_type]
    if not filtered_runs:
        return {"run": None, "report": None}

    latest_run = max(filtered_runs, key=lambda r: r.created)
    report_path = _report_path(latest_run.run_id, latest_run.type)
    report = None
    if report_path.exists():
        report = json.loads(report_path.read_text())
    return {"run": latest_run, "report": report}


# ─────────── /history ──────────
@app.get("/api/history")
def history():
    """
    Fetch the history of all scan runs along with their stored reports if available.
    Includes type of scans, date of scans, and files scanned.
    """
    runs = _runs()
    if not runs:
        return []

    history = []
    for run in runs:
        report_path = _report_path(run.run_id, run.type)
        report = None
        errors = None
        scanned_path = None
        if report_path.exists():
            report = json.loads(report_path.read_text())
            errors = report.get("errors", None)
            scanned_path = report.get("scanned_path")
        history.append(
            {
                "type": run.type,
                "date": run.created.isoformat(),
                "scanned_path": scanned_path,
                "errors": errors,
                "run": run,
                "report": report,
            }
        )
    return history


# ─────────── /history/scans ──────────
@app.get("/api/history/scans")
def scan_history(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search query for filtering"),
):
    """
    Fetch the history of all scan runs as a list of items (similar to /api/history but scan-only).
    """
    runs = _runs()
    if not runs:
        return {"items": [], "total": 0, "page": page, "limit": limit, "pages": 0}

    scan_history = []
    for run in runs:
        # Only include scan type runs
        if run.type != RunType.scan:
            continue

        report_path = _report_path(run.run_id, run.type)
        report = None
        errors = None
        scanned_path = None
        findings_by_file = {}

        if report_path.exists():
            report = json.loads(report_path.read_text())
            errors = report.get("errors", None)
            scanned_path = report.get("scanned_path")

            # Group findings by file for easy access
            if "findings" in report:
                for finding in report["findings"]:
                    file_path = finding.get("location", "unknown")
                    if file_path not in findings_by_file:
                        findings_by_file[file_path] = []
                    findings_by_file[file_path].append(finding)

        # Only include scans that have actual findings
        if not findings_by_file:
            continue

        # Get error message for failed scans
        error_message = None
        if run.status == "error" and report:
            error_message = report.get("error_message", "Unknown error occurred")

        scan_history.append(
            {
                "run_id": run.run_id,
                "type": run.type,
                "timestamp": run.created.isoformat(),
                "scanned_path": scanned_path or run.path,
                "status": run.status,
                "errors": errors,
                "error_message": error_message,
                "findings_by_file": findings_by_file,
                "total_findings": len(report.get("findings", [])) if report else 0,
                "run": run.model_dump(),
                "report": report,
            }
        )

    # Sort by timestamp, most recent first
    scan_history.sort(key=lambda x: x["timestamp"], reverse=True)

    # Apply search filter if provided
    if search:
        search_lower = search.lower()
        scan_history = [
            entry
            for entry in scan_history
            if (
                search_lower in entry["scanned_path"].lower()
                or search_lower in entry["run_id"].lower()
                or any(
                    search_lower in file_path.lower()
                    for file_path in entry["findings_by_file"].keys()
                )
            )
        ]

    total = len(scan_history)
    pages = (total + limit - 1) // limit

    # Apply pagination
    start = (page - 1) * limit
    end = start + limit
    items = scan_history[start:end]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


# ─────────── /history/inventory ──────────
@app.get("/api/history/inventory")
def inventory_history(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search query for filtering"),
):
    """
    Fetch the history of all inventory runs with file-level breakdown.
    """
    history = _load_inventory_history()

    if not history:
        return {"items": [], "total": 0, "page": page, "limit": limit, "pages": 0}

    # Apply search filter if provided
    if search:
        search_lower = search.lower()
        filtered_history = []
        for entry in history:
            # Check if search matches any field in the entry
            matches = (
                search_lower in entry.get("scanned_path", "").lower()
                or search_lower in entry.get("run_id", "").lower()
            )

            # Also check inventory_by_file for matches
            if not matches and "inventory_by_file" in entry:
                for file_record in entry["inventory_by_file"]:
                    if search_lower in file_record.get("file_path", "").lower() or any(
                        search_lower in framework.lower()
                        for framework in file_record.get("frameworks", [])
                    ):
                        matches = True
                        break

            if matches:
                filtered_history.append(entry)

        history = filtered_history

    total = len(history)
    pages = (total + limit - 1) // limit

    # Apply pagination
    start = (page - 1) * limit
    end = start + limit
    items = history[start:end]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


# ─────────── /scan ─────────────
@app.post("/api/scan", response_model=RunSummary)
async def scan(
    bg: BackgroundTasks,
    files: list[UploadFile] = File(default=[]),
    path: str | None = Query(None),  # Allow path to be passed as a query parameter
    depth: int | None = Form(None),  # Depth in FormData
    log_level: str | None = Form(None),  # Log level in FormData
):
    # 1) create a fresh workspace for this run
    rid = str(uuid.uuid4())
    work = DATA_DIR / rid
    work.mkdir()

    # 2) save each UploadFile, recreating any nested folders
    for up in files:
        dest = work / up.filename  # up.filename may be "src/App.tsx"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(await up.read())

    # 3) decide what to scan: the uploaded dir, or the provided path
    target = str(work if files else (path or _load_cfg().source_path))
    reported_path = path or "." if files else target

    # 4) build the CLI command & kick it off in background
    out = _report_path(rid, RunType.scan)
    cmd = (
        ["lintai", "scan", target, "--output", str(out)]
        + _common_flags(depth, log_level)
        + _env_cli_flags()
    )
    _kick(cmd, rid, bg)

    # 5) record & return the pending run
    run = RunSummary(
        run_id=rid,
        type=RunType.scan,
        created=datetime.now(timezone.utc),
        status="pending",
        path=reported_path,
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
        created=datetime.now(timezone.utc),  # Use timezone.utc instead of UTC
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
    # return {"status": "pending"} if not fp.exists() else json.loads(fp.read_text())
    if not fp.exists():
        return {"status": "pending"}

    data = json.loads(fp.read_text())
    logging.debug(f"Processing finding location data: {data}")  # Debug log

    if run.type is RunType.scan:
        findings = data.get("findings")
        if findings is None:
            raise HTTPException(500, "scan report missing 'findings'")

        base = (DATA_DIR / rid).resolve()

        for f in findings:
            loc = f.get("location")
            if not loc:
                continue
            try:
                # convert to Path and make it relative to base
                rel = Path(loc).resolve().relative_to(base)
                f["location"] = str(rel)
            except Exception:
                # if something doesn’t match, leave it unchanged
                pass

    return data


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

    findings = data.get("findings", [])
    if severity:
        findings = [f for f in findings if f.get("severity") == severity]
    if owasp_id:
        findings = [f for f in findings if owasp_id in f.get("owasp_id", "")]
    if component:
        findings = [f for f in findings if component in f.get("location", "")]

    data["findings"] = findings
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
    # Mount static assets first
    app.mount("/assets", StaticFiles(directory=frontend / "assets"), name="assets")

    # Serve individual static files
    @app.get("/favicon.svg")
    async def favicon():
        from fastapi.responses import FileResponse

        return FileResponse(frontend / "favicon.svg")

    @app.get("/mockServiceWorker.js")
    async def mock_service_worker():
        from fastapi.responses import FileResponse

        return FileResponse(frontend / "mockServiceWorker.js")

    # SPA catch-all route - this MUST be defined LAST
    @app.get("/{full_path:path}")
    async def spa_handler(full_path: str):
        from fastapi.responses import FileResponse

        # Serve index.html for any non-API route (SPA fallback)
        return FileResponse(frontend / "index.html")

else:
    log.warning("UI disabled – React build not found at %s", frontend)


# Enhanced history helper functions
def _load_scan_history() -> list[dict]:
    return _json_load(SCAN_HISTORY_FILE, [])


def _add_scan_history_entry(run: RunSummary, report: dict):
    """Add a scan entry with file-level breakdown and update existing files"""
    history = _load_scan_history()

    # Extract file-level findings
    findings_by_file = {}
    scanned_files = set()

    if report and "findings" in report:
        for finding in report["findings"]:
            file_path = finding.get("location", "unknown")
            scanned_files.add(file_path)
            if file_path not in findings_by_file:
                findings_by_file[file_path] = []
            findings_by_file[file_path].append(finding)

    # Remove older entries for files that are being rescanned
    updated_history = []
    for existing_entry in history:
        # Check if this entry contains any files that are being rescanned
        existing_files = set(existing_entry.get("findings_by_file", {}).keys())

        # If there's no overlap with scanned files, keep the entry
        # If there's overlap, we need to remove the overlapping files from this entry
        if not scanned_files.intersection(existing_files):
            updated_history.append(existing_entry)
        else:
            # Remove overlapping files from this entry
            filtered_findings = {
                file_path: findings
                for file_path, findings in existing_entry.get(
                    "findings_by_file", {}
                ).items()
                if file_path not in scanned_files
            }

            # Only keep the entry if it still has files after filtering
            if filtered_findings:
                existing_entry["findings_by_file"] = filtered_findings
                existing_entry["total_findings"] = sum(
                    len(findings) for findings in filtered_findings.values()
                )
                updated_history.append(existing_entry)

    # Create new entry with the latest scan results
    new_entry = {
        "run_id": run.run_id,
        "timestamp": run.created.isoformat(),
        "path": run.path,
        "status": run.status,
        "total_findings": len(report.get("findings", [])) if report else 0,
        "findings_by_file": findings_by_file,
        "report_summary": {
            "scanned_path": report.get("scanned_path") if report else None,
            "llm_usage": report.get("llm_usage") if report else None,
            "errors": report.get("errors") if report else None,
        },
    }

    # Add the new entry at the end (most recent position)
    updated_history.append(new_entry)

    # Keep only last 100 entries
    if len(updated_history) > 100:
        updated_history = updated_history[-100:]

    _json_dump(SCAN_HISTORY_FILE, updated_history)


def _load_inventory_history() -> list[dict]:
    return _json_load(INVENTORY_HISTORY_FILE, [])


def _add_inventory_history_entry(run: RunSummary, report: dict):
    """Add an inventory entry with file-level breakdown and update existing files"""
    history = _load_inventory_history()

    # Extract file-level inventory
    inventory_by_file = report.get("inventory_by_file", []) if report else []

    # Track which files are being updated in this scan
    scanned_files = set(file_inv.get("file_path") for file_inv in inventory_by_file)

    # Remove older entries for files that are being rescanned
    updated_history = []
    for existing_entry in history:
        # Check if this entry contains any files that are being rescanned
        existing_files = set(
            file_inv.get("file_path")
            for file_inv in existing_entry.get("inventory_by_file", [])
        )

        # If there's no overlap with scanned files, keep the entry
        # If there's overlap, we need to remove the overlapping files from this entry
        if not scanned_files.intersection(existing_files):
            updated_history.append(existing_entry)
        else:
            # Remove overlapping files from this entry
            filtered_inventory = [
                file_inv
                for file_inv in existing_entry.get("inventory_by_file", [])
                if file_inv.get("file_path") not in scanned_files
            ]

            # Only keep the entry if it still has files after filtering
            if filtered_inventory:
                existing_entry["inventory_by_file"] = filtered_inventory
                existing_entry["total_files"] = len(filtered_inventory)
                existing_entry["total_components"] = sum(
                    len(file_inv.get("components", []))
                    for file_inv in filtered_inventory
                )
                existing_entry["frameworks_found"] = list(
                    set(
                        framework
                        for file_inv in filtered_inventory
                        for framework in file_inv.get("frameworks", [])
                    )
                )
                updated_history.append(existing_entry)

    # Create new entry with the latest scan results
    new_entry = {
        "run_id": run.run_id,
        "timestamp": run.created.isoformat(),
        "path": run.path,
        "status": run.status,
        "total_files": len(inventory_by_file),
        "inventory_by_file": inventory_by_file,
        "frameworks_found": (
            list(
                set(
                    framework
                    for file_inv in inventory_by_file
                    for framework in file_inv.get("frameworks", [])
                )
            )
            if inventory_by_file
            else []
        ),
        "total_components": (
            sum(len(file_inv.get("components", [])) for file_inv in inventory_by_file)
            if inventory_by_file
            else 0
        ),
    }

    # Add the new entry at the end (most recent position)
    updated_history.append(new_entry)

    # Keep only last 100 entries
    if len(updated_history) > 100:
        updated_history = updated_history[-100:]

    _json_dump(INVENTORY_HISTORY_FILE, updated_history)
