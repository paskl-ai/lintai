import json
from pathlib import Path
from typing import List
from lintai.core.finding import Finding


def to_json(findings: List[Finding], out: Path):
    out.write_text(json.dumps([f.to_dict() for f in findings], indent=2))
