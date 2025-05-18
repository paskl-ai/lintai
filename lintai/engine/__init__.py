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
from lintai.engine.ai_call_analysis import ProjectAnalyzer


#: will be set by `initialise()` – None during import-time
ai_analyzer: Optional[ProjectAnalyzer] = None


def initialise(units: Iterable[PythonASTUnit], depth: int = 2) -> None:
    global ai_analyzer
    ai_analyzer = ProjectAnalyzer(units, call_depth=depth).analyze()
    if ai_analyzer:
        log = logging.getLogger("lintai.debug")
        log.debug("== AI sinks ==")
        for s in ai_analyzer.ai_calls:
            log.debug("  %s  @%s:%d", s.fq_name, s.file, s.lineno)

        log.debug("== AI-tagged functions (%d) ==", len(ai_analyzer.ai_functions))
        for fn in sorted(ai_analyzer.ai_functions):
            log.debug("  %s", fn)
