# lintai/engine/visitor.py
"""
Single‑pass AST dispatcher that feeds every registered detector.

Keeps detectors totally unchanged – they still accept a `SourceUnit`
and can call helpers like `unit.joined_fstrings()`.
"""

import ast, logging
from collections import defaultdict
from typing import Callable, Iterable, List
from lintai.core.finding import Finding
from lintai.detectors.base import SourceUnit

logger = logging.getLogger(__name__)

class _DispatchVisitor(ast.NodeVisitor):
    def __init__(self, unit: SourceUnit, detectors: Iterable[Callable]):
        self.unit = unit
        self.findings: List[Finding] = []

        # split detectors by declared scope
        self.module_detectors = []
        self.node_detectors   = defaultdict(list)

        for d in detectors:
            scope = getattr(d, "_lintai_scope", "module")
            if scope == "module":
                self.module_detectors.append(d)
            elif scope == "node":
                for node_type in getattr(d, "_lintai_node_types", ()):
                    self.node_detectors[node_type].append(d)

    # --- run once per file ------------------------------------------------
    def visit_Module(self, node):
        self.unit._current = node
        for fn in self.module_detectors:
            self._safe_call(fn)
        self.generic_visit(node)

    # --- dispatch node‑level detectors ------------------------------------
    def generic_visit(self, node):
        self.unit._current = node
        for fn in self.node_detectors.get(type(node), ()):
            self._safe_call(fn)
        super().generic_visit(node)

    # --- helper for safe calling the detectors -----------------------------
    def _safe_call(self, fn):
        try:
            self.findings.extend(fn(self.unit))
        except Exception as exc:
            logger.error("Detector %s crashed: %s", fn.__name__, exc)

