from __future__ import annotations

import json, importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# -----------------------------------------------------------------------
#  monkey-patch file locations BEFORE importing the server
# -----------------------------------------------------------------------
import lintai.ui.server as ui


@pytest.fixture(autouse=True)
def _isolate_files(tmp_path, monkeypatch):
    tmp = tmp_path / "ui-data"
    tmp.mkdir()
    monkeypatch.setattr(ui, "DATA_DIR", tmp, raising=True)
    monkeypatch.setattr(ui, "RUNS_FILE", tmp / "runs.json", raising=True)
    monkeypatch.setattr(ui, "CONFIG_JSON", tmp / "config.json", raising=True)
    monkeypatch.setattr(ui, "CFG_ENV", tmp / "config.env", raising=True)
    monkeypatch.setattr(ui, "SECR_ENV", tmp / "secrets.env", raising=True)

    # re-import so the helpers pick up new paths
    importlib.reload(ui)
    ui._save_runs([])
    yield
    ui._save_runs([])


@pytest.fixture
def client():
    return TestClient(ui.app)


# -----------------------------------------------------------------------
def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_config_roundtrip(client):
    cfg = {
        "source_path": ".",
        "ai_call_depth": 3,
        "log_level": "DEBUG",
        "ruleset": None,
        "env_file": None,
    }
    assert client.post("/api/config", json=cfg).json() == cfg
    assert client.get("/api/config").json() == cfg


# util to drop fake reports
def _fake_report(rid: str, kind: str):
    if kind == "scan":
        fp = ui.DATA_DIR / rid / "scan_report.json"
        data = {
            "type": "scan",
            "data": {"llm_usage": {}, "findings": [{"severity": "high"}]},
        }
    else:
        fp = ui.DATA_DIR / f"{rid}_inventory.json"
        data = {"type": "inventory", "data": {"nodes": [{"id": "A"}], "edges": []}}
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(json.dumps(data))


def test_full_flow(client, monkeypatch, tmp_path):
    monkeypatch.setattr(ui.subprocess, "run", lambda *a, **k: None)
    monkeypatch.setattr(ui.subprocess, "CalledProcessError", RuntimeError)

    code = tmp_path / "bot.py"
    code.write_text("print('x')")
    r1 = client.post("/api/scan", files={"files": ("bot.py", code.read_bytes())}).json()
    r2 = client.post("/api/inventory", params={"path": str(tmp_path)}).json()

    runs = client.get("/api/runs").json()
    assert {runs[0]["run_id"], runs[1]["run_id"]} == {r1["run_id"], r2["run_id"]}

    _fake_report(r1["run_id"], "scan")
    _fake_report(r2["run_id"], "inventory")

    assert client.get(f"/api/results/{r1['run_id']}").json()["type"] == "scan"
    assert client.get(f"/api/results/{r2['run_id']}").json()["type"] == "inventory"

    assert client.get(
        f"/api/results/{r1['run_id']}/filter", params={"severity": "high"}
    ).json()["data"]["findings"]

    assert client.get(
        f"/api/inventory/{r2['run_id']}/subgraph", params={"node": "A"}
    ).json()["nodes"] == [{"id": "A"}]
