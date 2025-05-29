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
def _sandbox(tmp_path, monkeypatch):
    """
    Set up a temporary workspace for the UI tests.
      • redirect every file location (DATA_DIR, …)
      • replace ui.ROOT with a temp workspace
      • finally reload the module so the FastAPI routes pick up
        the new constants.
    """
    # 1 — tmp workspace for the fake source tree
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "foo").mkdir()
    (ws / "foo" / "bar.txt").write_text("x")
    (ws / "top.txt").write_text("y")

    # 2 — tmp area for the UI’s own state
    ui_store = tmp_path / "ui-data"
    ui_store.mkdir()

    # 3 — reload so the FastAPI router uses the patched constants
    new_ui = importlib.reload(ui)

    # re-apply all monkey-patches on the freshly-loaded module
    monkeypatch.setattr(new_ui, "ROOT", ws, raising=False)
    monkeypatch.setattr(new_ui, "DATA_DIR", ui_store, raising=True)
    monkeypatch.setattr(new_ui, "RUNS_FILE", ui_store / "runs.json", raising=True)
    monkeypatch.setattr(new_ui, "CONFIG_JSON", ui_store / "config.json", raising=True)
    monkeypatch.setattr(new_ui, "CFG_ENV", ui_store / "config.env", raising=True)
    monkeypatch.setattr(new_ui, "SECR_ENV", ui_store / "secrets.env", raising=True)
    new_ui._save_runs([])  # ensure clean state


@pytest.fixture
def client(_sandbox):
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


def test_list_root(client, tmp_path):
    resp = client.get("/api/fs")
    assert resp.status_code == 200

    data = resp.json()
    assert Path(data["cwd"]).name == ""
    assert {i["name"] for i in data["items"]} == {"foo", "top.txt"}


def test_list_subdir(client):
    resp = client.get("/api/fs", params={"path": "foo"})
    assert {i["name"] for i in resp.json()["items"]} == {"bar.txt"}


def test_block_escape(client):
    # Path outside ROOT should be rejected
    assert client.get("/api/fs", params={"path": "../"}).status_code == 403
