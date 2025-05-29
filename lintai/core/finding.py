from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional, Any


@dataclass
class Finding:
    detector_id: str
    owasp_id: str
    mitre: List[str]
    severity: str
    message: str
    location: Optional[Path] = None
    line: Optional[int] = None
    fix: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        # pathlib.Path → str so json.dumps never chokes
        if isinstance(data["location"], Path):
            data["location"] = str(data["location"])
        return data
