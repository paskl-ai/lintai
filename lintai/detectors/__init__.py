from typing import Callable, Dict, List
from .base import SourceUnit
from lintai.core.finding import Finding

_REGISTRY: Dict[str, Callable[[SourceUnit], List[Finding]]] = {}

def register(rule_id: str):
    def _decorator(func):
        _REGISTRY[rule_id] = func
        return func
    return _decorator

def run_all(unit: "SourceUnit"):
    findings = []
    for detector in _REGISTRY.values():
        findings.extend(detector(unit))
    return findings
