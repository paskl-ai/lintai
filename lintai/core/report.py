# lintai/core/report.py
import json
import sys
from pathlib import Path
from typing import List, Any, Optional
from lintai.core.finding import Finding
from lintai.llm.budget import manager as _budget


def write_graph_inventory_report(graph_records: list[dict], out: Path | None):
    """
    Each entry:  {sink, at, elements:{nodes, edges}}
    """
    doc = {
        "type": "inventory",
        "version": 1,
        "data": {
            "records": graph_records,
            # flatten for quick /subgraph queries
            "nodes": [n for r in graph_records for n in r["elements"]["nodes"]],
            "edges": [e for r in graph_records for e in r["elements"]["edges"]],
        },
    }
    if out:
        out.write_text(json.dumps(doc, indent=2))
    else:
        json.dump(doc, sys.stdout, indent=2)


def write_scan_report(findings: List[Finding], out: Optional[Path]):
    report = {
        "llm_usage": _budget.snapshot(),
        "findings": [f.to_dict() for f in findings],
    }
    json_str = json.dumps(report, indent=2)
    if out:
        out.write_text(json_str)
    else:
        print(json_str)


def write_simple_inventory_report(inventory: List[dict[str, Any]], out: Optional[Path]):
    json_str = json.dumps(inventory, indent=2)
    if out:
        out.write_text(json_str)
    else:
        print(json_str)
