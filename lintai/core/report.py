# lintai/core/report.py
import json
import sys
from pathlib import Path
from typing import List, Any, Optional
from lintai.core.finding import Finding
from lintai.llm.budget import manager as _budget


# --- Report creation functions ---
def make_scan_report(findings: List[Finding], scanned_path: str) -> dict:
    return {
        "type": "scan",
        "scanned_path": scanned_path,
        "llm_usage": _budget.snapshot(),
        "findings": [f.to_dict() for f in findings],
    }


def make_graph_inventory_report(graph_records: list[dict], scanned_path: str) -> dict:
    return {
        "type": "inventory",
        "version": 1,
        "scanned_path": scanned_path,
        "data": {
            "records": graph_records,
            "nodes": [n for r in graph_records for n in r["elements"]["nodes"]],
            "edges": [e for r in graph_records for e in r["elements"]["edges"]],
        },
    }


def make_simple_inventory_report(inventory: Any, scanned_path: str) -> dict:
    if isinstance(inventory, dict):
        inventory = dict(inventory)  # copy
        inventory["scanned_path"] = scanned_path
        return inventory
    return {"type": "inventory", "scanned_path": scanned_path, "data": inventory}


# --- Report output functions ---
def write_report_obj(obj: dict, out: Optional[Path]):
    json_str = json.dumps(obj, indent=2)
    if out:
        out.write_text(json_str)
    else:
        import typer

        typer.echo(json_str)
