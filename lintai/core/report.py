# lintai/core/report.py
import json
import sys
from pathlib import Path
from typing import List, Any, Optional
from lintai.core.finding import Finding
from lintai.llm.budget import manager as _budget


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


def write_inventory_report(inventory: List[dict[str, Any]], out: Optional[Path]):
    json_str = json.dumps(inventory, indent=2)
    if out:
        out.write_text(json_str)
    else:
        print(json_str)
