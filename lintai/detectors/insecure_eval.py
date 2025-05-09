import ast
from lintai.detectors import register
from lintai.core.finding import Finding

@register("PY01", scope="node", node_types=(ast.Call,))
def detect_eval_call(unit):
    call = unit._current        # visitor sets this
    if isinstance(call.func, ast.Name) and call.func.id == "eval":
        yield Finding(
            owasp_id="PY01",
            mitre=["T1059"],
            severity="high",
            message="Use of builtin eval() is unsafe",
            location=unit.path,
            line=call.lineno,
            fix="Replace eval() with ast.literal_eval() or safer code",
        )
