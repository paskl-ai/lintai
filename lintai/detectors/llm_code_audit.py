"""
AI_LLM01 – LLM-powered audit of “hot” GenAI calls.

✓ Skips when all tainted inputs are sanitised
✓ Understands helper names  escape_braces(),  sanitize_*,  redact_* …
✓ Sends the *entire surrounding function* to the model for context
"""

from __future__ import annotations

import ast
import json
import logging
import re
import textwrap
from typing import Optional

from lintai.core.finding import Finding
from lintai.detectors import register
from lintai.engine.ai_tags import is_hot_call
from lintai.llm import get_client

logger = logging.getLogger(__name__)
_CLIENT = get_client()  # dummy stub if provider missing

# --------------------------------------------------------------------------- #
# constants / patterns                                                        #
# --------------------------------------------------------------------------- #
_CODE_RE = re.compile(r"```(?:json)?\s*(\{.*?})\s*```", re.S | re.I)

_SANITIZERS = {"escape_braces", "sanitize", "redact_secrets"}
_SANITIZER_RE = re.compile(r"(^|\.)\s*(sanitize|escape|redact|clean)\w*$", re.I)

_IGNORE_PREFIXES = (
    "llm detection disabled",
    "openai sdk error",
    "sdk unavailable",
    "clean",  # model replied “issue = clean”
)


# --------------------------------------------------------------------------- #
# helper functions                                                             #
# --------------------------------------------------------------------------- #
def _is_sanitizer(name: str) -> bool:
    return name in _SANITIZERS or bool(_SANITIZER_RE.match(name))


def _json_fragment(reply: str) -> Optional[str]:
    """Extract the `{…}` JSON object from an LLM reply."""
    m = _CODE_RE.search(reply)
    if m:
        return m.group(1).strip()
    reply = reply.strip()
    return reply if reply.startswith("{") and reply.endswith("}") else None


def _call_has_sanitised_args(node: ast.Call) -> bool:
    """
    Quick heuristic: return True iff *every* positional / keyword arg is either
    not user-controlled **or** directly wrapped in a recognised sanitiser.
    """

    def _sanitised(arg: ast.AST) -> bool:
        if isinstance(arg, ast.Call):
            fn = arg.func
            fn_name = (
                fn.attr
                if isinstance(fn, ast.Attribute)
                else fn.id if isinstance(fn, ast.Name) else ""
            )
            return _is_sanitizer(fn_name)
        return False

    args_iter = list(node.args) + [kw.value for kw in node.keywords]
    return all(_sanitised(a) for a in args_iter)


def _get_enclosing_function_source(call: ast.Call, source: str, tree: ast.AST) -> str:
    """
    Return the source text for the smallest `FunctionDef` that fully encloses
    *call*. Falls back to the call snippet when no enclosing function exists.
    """
    lineno = call.lineno
    best: Optional[ast.FunctionDef] = None

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            # Requires Python 3.8+ for end_lineno
            start, end = node.lineno, getattr(node, "end_lineno", node.lineno)
            if start <= lineno <= end:
                # Choose the *innermost* function (greatest start line)
                if best is None or start > best.lineno:
                    best = node

    target = best if best is not None else call
    return ast.get_source_segment(source, target) or "<code unavailable>"


# --------------------------------------------------------------------------- #
# detector                                                                    #
# --------------------------------------------------------------------------- #
@register("AI_LLM01", scope="node", node_types=(ast.Call,))
def llm_audit(unit):
    call = unit._current
    if not is_hot_call(call):
        return  # not a model call

    # Short-circuit when everything is already routed through sanitisers
    if unit.is_user_tainted(call) and _call_has_sanitised_args(call):
        return

    # Obtain the module AST (attribute name differs across versions)
    tree = getattr(unit, "tree", getattr(unit, "_tree", None))
    if tree is None:
        logger.debug("llm_code_audit: AST missing – skipped")
        return

    func_src = _get_enclosing_function_source(call, unit.source, tree)

    prompt = textwrap.dedent(
        f"""
        You are a secure-coding assistant.

        ## Context
        * Trusted sanitisers: {", ".join(sorted(_SANITIZERS))} and anything
          matching /{_SANITIZER_RE.pattern}/
        * If **all** user-controlled values reach the model only through those
          sanitisers, reply with: {{ "issue": "clean" }}

        ## Task
        Identify OWASP GenAI risks in the code below. Respond with **single-line**
        JSON containing "issue", "sev", "fix", "owasp" and optional "mitre".

        ```python
        {func_src}
        ```
        """
    ).strip()

    logger.debug(f"llm_code_audit: detecting issues in {unit.path}")

    try:
        reply = _CLIENT.ask(prompt, max_tokens=180)
    except Exception as exc:
        logger.debug("llm_code_audit: provider error %s – skipped", exc)
        return

    payload = _json_fragment(reply)
    if not payload:
        logger.debug("llm_code_audit: non-JSON reply – skipped")
        return

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        logger.debug("llm_code_audit: bad JSON – skipped")
        return

    issue = str(data.get("issue", "")).lower()
    if any(issue.startswith(p) for p in _IGNORE_PREFIXES):
        logger.debug("llm_code_audit: benign / clean – skipped")
        return

    yield Finding(
        owasp_id=data.get("owasp", "Axx"),
        mitre=data.get("mitre", []),
        severity=str(data.get("sev", "info")).lower(),
        message=f"LLM audit: {data['issue']}",
        location=unit.path,
        line=call.lineno,
        fix=data.get("fix", ""),
    )
