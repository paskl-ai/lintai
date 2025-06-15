"""
lintai.engine package initialisation
------------------------------------
Exposes a **singleton** `ai_analyzer` once CLI has called `initialise()`.
Detectors can simply do:

    from lintai.engine import ai_analyzer

and query `ai_analyzer.ai_functions`, etc.
"""

from __future__ import annotations
from typing import Iterable, Optional
import logging

from lintai.engine.python_ast_unit import PythonASTUnit
from lintai.engine.analysis import ProjectAnalyzer


#: will be set by `initialise()` – None during import-time
ai_analyzer: Optional[ProjectAnalyzer] = None


def initialise(units: Iterable[PythonASTUnit], depth: int = 2) -> None:
    global ai_analyzer
    ai_analyzer = ProjectAnalyzer(units, call_depth=depth).analyze()
