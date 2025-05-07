from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

@dataclass
class Finding:
    owasp_id: str
    mitre: List[str]
    severity: str
    message: str
    location: Optional[Path] = None
    line: Optional[int] = None
    fix: Optional[str] = None

    def to_dict(self):
        return self.__dict__
