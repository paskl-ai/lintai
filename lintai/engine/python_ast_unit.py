"""
A thin wrapper around `ast` that satisfies lintai.detectors.base.SourceUnit.

It:
•  Parses a single *.py* file.
•  Exposes helper methods detectors need today.
•  Is intentionally simple – improve taint‑tracking heuristics over time.
"""

from __future__ import annotations
import ast
from pathlib import Path
from typing import Iterable, List

from lintai.detectors.base import SourceUnit


class PythonASTUnit(SourceUnit):
    def __init__(self, path: Path, text: str):
        super().__init__(path)
        self.tree = ast.parse(text, filename=str(path))
        self._calls: List[ast.Call] = [
            n for n in ast.walk(self.tree) if isinstance(n, ast.Call)
        ]

    # --------------------------------------------------------------------- #
    # utilities detectors use today                                         #
    # --------------------------------------------------------------------- #
    def joined_fstrings(self) -> Iterable[ast.JoinedStr]:
        return (n for n in ast.walk(self.tree) if isinstance(n, ast.JoinedStr))

    def calls(self) -> Iterable[ast.Call]:
        return self._calls

    def has_call(self, name: str, node: ast.AST) -> bool:
        """Does *node* (or its children) contain a Call whose dotted name ends‑with *name*?"""
        for n in ast.walk(node):
            if isinstance(n, ast.Call):
                func = n.func
                if isinstance(func, ast.Attribute):
                    dotted = _attr_to_str(func)
                elif isinstance(func, ast.Name):
                    dotted = func.id
                else:
                    continue
                if dotted.endswith(name):
                    return True
        return False

    # ----------------------- naïve taint logic --------------------------- #
    _TAINT_SOURCES = {"input", "sys.stdin"}

    def is_user_tainted(self, node: ast.AST) -> bool:
        """
        Very simple heuristic:
        • any Name whose id == 'user_input'
        • any Call to built‑in input()
        • any attribute/Name matching _TAINT_SOURCES
        """
        for n in ast.walk(node):
            if isinstance(n, ast.Name) and n.id.lower().startswith("user_"):
                return True
            if isinstance(n, ast.Call):
                target = _attr_to_str(n.func)
                if target in self._TAINT_SOURCES:
                    return True
        return False

    # placeholder – required by LLM02 detector
    def is_model_response(self, arg: ast.AST) -> bool:  # noqa: D401
        """Return True if *arg* is obviously an LLM completion response (heuristic)."""
        if isinstance(arg, ast.Call):
            return _attr_to_str(arg.func).endswith("ChatCompletion.create")
        return False


# ------------------------------------------------------------------------- #
# helpers                                                                   #
# ------------------------------------------------------------------------- #
def _attr_to_str(node: ast.AST) -> str:
    """Convert `foo.bar.baz` Attribute node into dotted string."""
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    return ".".join(reversed(parts))
