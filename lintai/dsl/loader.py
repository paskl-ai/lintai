from __future__ import annotations
import ast, json, yaml, pathlib, re
from lintai.detectors import register
from lintai.core.finding import Finding
from lintai.detectors.base import SourceUnit


def _load_one(rule: dict):
    nid = rule["id"]
    scope = rule.get("scope", "module")
    node_types = tuple(getattr(ast, t) for t in rule.get("node_types", []))

    pattern_src = rule["pattern"]
    compiled_re = re.compile(pattern_src)

    def _extract_text(node: ast.AST) -> str:
        # literal or triple‑quoted template
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value

        # f‑string
        if isinstance(node, ast.JoinedStr):
            parts = []
            for v in node.values:
                if isinstance(v, ast.Constant) and isinstance(v.value, str):
                    parts.append(v.value)
                elif isinstance(v, ast.FormattedValue):
                    if isinstance(v.value, ast.Name):  # {variable}
                        parts.append("{" + v.value.id + "}")
                    else:
                        parts.append("{...}")  # other expression
            return "".join(parts)

        return ""

    # generate detector on‑the‑fly
    @register(nid, scope=scope, node_types=node_types)
    def _generated(unit: SourceUnit, _r=rule, _cre=compiled_re):
        node = unit._current
        code = _extract_text(node)
        if code and _cre.search(code):
            yield Finding(
                owasp_id=_r.get("owasp_id", nid),
                severity=_r.get("severity", "info"),
                mitre=_r.get("mitre", []),
                message=_r["message"],
                location=unit.path,
                line=getattr(node, "lineno", None),
                fix=_r.get("fix", ""),
            )


def load_rules(path: str | pathlib.Path):
    p = pathlib.Path(path)
    if p.is_dir():
        files = list(p.glob("*.y*ml")) + list(p.glob("*.json"))
    else:
        files = [p]
    for file in files:
        data = (
            yaml.safe_load(file.read_text())
            if file.suffix in {".yml", ".yaml"}
            else json.loads(file.read_text())
        )
        if isinstance(data, list):
            for rule in data:
                _load_one(rule)
        else:
            _load_one(data)
