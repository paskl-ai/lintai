"""
Detector registry & auto‑discovery.

Add `@register("RULE_ID")` above any `detect(unit)` function inside this
package (or a pip‑installed plugin advertising the `lintai.detectors` entry‑point)
and it will be executed automatically.
"""

import importlib
import pkgutil
import sys
from typing import Callable, Dict, List

from lintai.engine.visitor import _DispatchVisitor
from lintai.detectors.base import SourceUnit  # local import is fine
from lintai.core.finding import Finding
import logging

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# 1. public registry & decorator                                              #
# --------------------------------------------------------------------------- #
_REGISTRY: Dict[str, List[Callable]] = {}

def register(rule_id: str, *, scope: str = "module", node_types=()):
    """
    scope: "module"  – run once on the top‑level Module node   (default)
           "node"    – run on every AST node whose type is in node_types
    node_types: tuple of ast.* classes, only for scope="node"
    """
    def _decorator(fn):
        fn._lintai_rule_id   = rule_id
        fn._lintai_scope = scope
        fn._lintai_node_types = node_types
        _REGISTRY.setdefault(rule_id, []).append(fn)
        return fn
    return _decorator


# --------------------------------------------------------------------------- #
# 2. built‑in detector auto‑import                                            #
# --------------------------------------------------------------------------- #
_DISCOVERED = False  # guard so we only scan once


def _discover_builtin():
    """Import every *module* in lintai.detectors so their
    `@register` decorators run and populate _REGISTRY."""
    global _DISCOVERED
    if _DISCOVERED:
        return

    pkg = sys.modules[__name__]  # this package object
    for finder, name, is_pkg in pkgutil.iter_modules(pkg.__path__):
        if is_pkg or name.startswith("_"):
            continue
        importlib.import_module(f"{pkg.__name__}.{name}")

    _DISCOVERED = True


# --------------------------------------------------------------------------- #
# 3. public API: run all detectors                                            #
# --------------------------------------------------------------------------- #
def run_all(unit: SourceUnit) -> List[Finding]:
    from lintai.engine.visitor import _DispatchVisitor  # deferred import
 
    _discover_builtin()
    detectors = [d for lst in _REGISTRY.values() for d in lst]
    visitor = _DispatchVisitor(unit, detectors)
    visitor.visit(unit.tree)
    return visitor.findings


