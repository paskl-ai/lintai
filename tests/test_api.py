# tests/test_api.py
from __future__ import annotations
from pathlib import Path
import json, uuid
import pytest
from fastapi.testclient import TestClient

# import AFTER we monkey-patch DATA_DIR
import lintai.ui.server as ui


@pytest.fixture(autouse=True)
def _isolate_tmp(tmp_path, monkeypatch):
    """Point server.DATA_DIR to a temp dir for every test run."""
    tmp = tmp_path / "ui-data"
    tmp.mkdir()
    monkeypatch.setattr(ui, "DATA_DIR", tmp, raising=True)
    # Re-create config / run index in tmp path
    (tmp / "runs.json").write_text("[]")
    yield


@pytest.fixture
def client():
    return TestClient(ui.app)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_config_roundtrip(client):
    new_cfg = {"source_path": ".", "ai_call_depth": 3, "ruleset": None}
    assert client.post("/api/config", json=new_cfg).json() == new_cfg
    assert client.get("/api/config").json() == new_cfg


def _fake_report(run_id: str, kind: str):
    if kind == "scan":
        path = ui.DATA_DIR / run_id / "scan_report.json"
        data = {
            "type": "scan",
            "data": {
                "llm_usage": {},
                "findings": [{"owasp_id": "A01", "severity": "high"}],
            },
        }
    else:
        path = ui.DATA_DIR / f"{run_id}_inventory.json"
        data = {
            "type": "inventory",
            "data": {"nodes": [{"id": "A"}], "edges": []},
        }
    path.parent.mkdir(exist_ok=True, parents=True)
    path.write_text(json.dumps(data))


def test_full_flow(client, monkeypatch, tmp_path):
    # stub subprocess so we don’t invoke real scans
    monkeypatch.setattr(ui.subprocess, "run", lambda *a, **k: None)
    monkeypatch.setattr(ui.subprocess, "CalledProcessError", RuntimeError)

    # ---- scan run
    code_file = tmp_path / "bot.py"
    code_file.write_text("print('x')")
    resp = client.post("/api/scan", files={"files": ("bot.py", code_file.read_bytes())})
    scan_run = resp.json()
    rid_scan = scan_run["run_id"]

    # ---- inventory run
    resp2 = client.post("/api/inventory", params={"path": str(tmp_path)})
    inv_run = resp2.json()
    rid_inv = inv_run["run_id"]

    # runs index should list two pending runs
    runs = client.get("/api/runs").json()
    assert {r["run_id"] for r in runs} == {rid_scan, rid_inv}

    # craft dummy result files -> mimick completed runs
    _fake_report(rid_scan, "scan")
    _fake_report(rid_inv, "inventory")  # file path logic inside helper

    # results should now be 'done'
    assert client.get(f"/api/results/{rid_scan}").json()["type"] == "scan"
    assert client.get(f"/api/results/{rid_inv}").json()["type"] == "inventory"

    # filtering endpoint shrinks list
    filtered = client.get(
        f"/api/results/{rid_scan}/filter", params={"severity": "high"}
    ).json()
    assert len(filtered["data"]["findings"]) == 1

    # subgraph returns subset
    sg = client.get(
        f"/api/inventory/{rid_inv}/subgraph", params={"node": "A", "depth": 1}
    ).json()
    assert sg["nodes"] == [{"id": "A"}]
