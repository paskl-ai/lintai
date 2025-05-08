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

from lintai.detectors.base import SourceUnit  # local import is fine
from lintai.core.finding import Finding
import logging

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# 1. public registry & decorator                                              #
# --------------------------------------------------------------------------- #
_REGISTRY: Dict[str, List[Callable[[SourceUnit], List[Finding]]]] = {}


def register(rule_id: str):
    """Decorator used by individual detector modules."""

    def _decorator(func: Callable[[SourceUnit], List[Finding]]):
        _REGISTRY.setdefault(rule_id, []).append(func)
        return func

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
# 3. public helper used by CLI / adapters                                     #
# --------------------------------------------------------------------------- #
def run_all(unit: SourceUnit) -> List[Finding]:
    """
    Ensure all detectors are imported, then execute them sequentially,
    aggregating their Finding objects.
    """
    _discover_builtin()

    findings: List[Finding] = []
    for rule_id, funcs in _REGISTRY.items():
        for fn in funcs:
            try:
                findings.extend(fn(unit))
            except Exception as exc:  # keep one bad detector from killing scan
                logger.error(
                    f"[lintai] detector {fn.__module__}:{fn.__name__} crashed: {exc}"
                )

    return findings
