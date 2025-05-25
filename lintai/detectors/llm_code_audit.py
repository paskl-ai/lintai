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

from lintai.engine.ai_call_analysis import ProjectAnalyzer
from lintai.core.finding import Finding
from lintai.detectors import register
from lintai.llm import get_client
from lintai.engine.ai_call_analysis import is_ai_call

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
_EMITTED: set[tuple[str, int, str]] = set()


# --------------------------------------------------------------------------- #
# helper functions                                                             #
# --------------------------------------------------------------------------- #
import ast
import textwrap


def _snippet(node: ast.AST, src: str, max_lines: int = 60) -> str:
    """
    Return cleaned, dedented source for *node*, trimmed to *max_lines*.

    • Strips module / function / class doc-strings (so the LLM
      does not waste tokens on doc text).
    • Drops single-line comments and blank lines.
    • Leaves triple-quoted strings that are *inside* the code logic
      (those are usually prompts we *do* want the model to see).
    """
    # --- 1. get raw text for the node -----------------------------------
    raw = ast.get_source_segment(src, node) or ""
    if not raw:
        return "<code unavailable>"

    # --- 2. parse & delete doc-strings ----------------------------------
    class _DocstringStripper(ast.NodeTransformer):
        def _strip(self, n: ast.AST):
            if (
                n.body
                and isinstance(n.body[0], ast.Expr)
                and isinstance(n.body[0].value, ast.Constant)
                and isinstance(n.body[0].value.value, str)
            ):
                n.body = n.body[1:]

        def visit_FunctionDef(self, n):
            self.generic_visit(n)
            self._strip(n)
            return n

        def visit_AsyncFunctionDef(self, n):
            self.generic_visit(n)
            self._strip(n)
            return n

        def visit_ClassDef(self, n):
            self.generic_visit(n)
            self._strip(n)
            return n

        def visit_Module(self, n):
            self.generic_visit(n)
            self._strip(n)
            return n

    try:
        tree = ast.parse(raw)
        tree = _DocstringStripper().visit(tree)
        ast.fix_missing_locations(tree)
        cleaned = ast.unparse(tree)
    except Exception:  # fallback – never fail hard
        cleaned = raw

    # --- 3. dedent + drop comments / blanks -----------------------------
    lines = textwrap.dedent(cleaned).splitlines()
    lines = [ln for ln in lines if ln.strip() and not ln.lstrip().startswith("#")]

    if len(lines) > max_lines:
        lines = lines[:max_lines] + ["    # …trimmed…"]

    return "\n".join(lines)


def _path_context(unit, func_node: ast.AST, max_funcs: int = 3) -> str:
    """
    Using the project-wide call-graph gather up to *max_funcs* direct
    callers **and** direct callees of *func_node* and return their source
    text (clipped) as one big string.
    """
    try:
        from lintai.engine import ai_analyzer  # late import → no cycle

        if not ai_analyzer:
            return ""

        qname = unit.qualname(func_node)  # PythonASTUnit helper
        callers = list(ai_analyzer.callers_of(qname))[:max_funcs]
        callers_src = []
        for name in callers:
            src_unit, node = ai_analyzer.source_of(name)  # (PythonASTUnit, ast.AST)
            callers_src.append(_snippet(node, src_unit.source))

        san_callees = set()
        san_callee_blocks = []
        for name in ai_analyzer.callees_of(qname):
            if any(fn in name for fn in _SANITIZERS) or _SANITIZER_RE.search(name):
                src_unit, node = ai_analyzer.source_of(name)
                san_callees.add(name)
                san_callee_blocks.append(_snippet(node, src_unit.source))

        other_callees = [
            c for c in ai_analyzer.callees_of(qname) if c not in san_callees
        ][:max_funcs]

        callees_src = san_callee_blocks
        for name in other_callees:
            src_unit, node = ai_analyzer.source_of(name)
            callees_src.append(_snippet(node, src_unit.source))

        if not callers_src and not callees_src:
            return ""

        parts = ["\n### CALL-FLOW CONTEXT ###"]
        if callers_src:
            parts.append("\n\n# ⇧  DIRECT CALLERS\n" + "\n\n".join(callers_src))
        if callees_src:
            parts.append("\n\n# ⇩  DIRECT CALLEES\n" + "\n\n".join(callees_src))
        return "\n".join(parts)

    except Exception as exc:
        logger.debug("llm_code_audit: context error – %s", exc)
        return ""


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


_SEEN_FUNCS: set[tuple[str, int]] = set()


def _debug_ancestry(node):
    chain = []
    while node:
        chain.append(f"{type(node).__name__}:{getattr(node,'lineno', '?')}")
        node = getattr(node, "parent", None)
    return " -> ".join(chain)


def _is_trivial_wrapper(
    fn: ast.FunctionDef | ast.AsyncFunctionDef,
    *,
    src: str,
) -> bool:
    """
    True **only when** the *cleaned* source of *fn* (with doc-strings,
    comments and blank lines stripped) contains a **single** executable
    statement that is one of:

      • a bare call        →   ``foo(bar)``
      • ``return``         →   ``return``
      • ``return <Call>``  →   ``return do()``.

    Anything longer – even an extra ``print()`` – is considered
    non-trivial and must be audited.
    """
    try:
        # Use the same cleaner that feeds the LLM so comments/doc-strings
        # never influence the result.
        cleaned = _snippet(fn, src, max_lines=999_999)  # keep full body
        tree = ast.parse(cleaned)
        body = (
            tree.body[0].body
            if isinstance(tree.body[0], (ast.FunctionDef, ast.AsyncFunctionDef))
            else tree.body
        )

        if len(body) != 1:
            return False

        stmt = body[0]
        if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
            return True
        if isinstance(stmt, ast.Return):
            return stmt.value is None or isinstance(stmt.value, ast.Call)
        return False
    except Exception:
        # On any parsing hiccup fall back to *not* skipping
        return False


@register("AI_LLM01", scope="node", node_types=(ast.Call,))
def llm_audit(unit):
    call = unit._current

    if not is_ai_call(call):
        return

    if getattr(_CLIENT, "is_dummy", False):
        logger.debug(
            "llm_code_audit: dummy client – skipping call at %s:%s",
            unit.path,
            call.lineno,
        )
        return

    logger.debug("llm_code_audit: call at %s:%s", unit.path, call.lineno)

    # climb to the nearest function *or* lambda
    func_node = call
    while func_node and not isinstance(
        func_node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)
    ):
        func_node = getattr(func_node, "parent", None)

    if func_node is None:  # top-level call → treat the Module as key
        key = (str(unit.path), "module", call.lineno)
    else:
        key = (str(unit.path), func_node.lineno)

    if key in _SEEN_FUNCS:
        logger.debug("Skipping duplicate call in scope %s", key)
        return
    _SEEN_FUNCS.add(key)

    logger.debug(
        "Visiting call at %s:%s - ancestry: %s",
        unit.path,
        call.lineno,
        _debug_ancestry(call),
    )

    # Short-circuit when everything is already routed through sanitisers
    if unit.is_user_tainted(call) and _call_has_sanitised_args(call):
        return

    if isinstance(
        func_node, (ast.FunctionDef, ast.AsyncFunctionDef)
    ) and _is_trivial_wrapper(func_node, src=unit.source):
        logger.debug("llm_code_audit: trivial wrapper – skipped")
        return

    # Obtain the module AST (attribute name differs across versions)
    tree = getattr(unit, "tree", getattr(unit, "_tree", None))
    if tree is None:
        logger.debug("llm_code_audit: AST missing – skipped")
        return

    func_src = _get_enclosing_function_source(call, unit.source, tree)
    flow_src = _path_context(unit, func_node)

    prompt = textwrap.dedent(
        f"""
        ## Context
        You are a security expert reviewing Python source code for **OWASP Top-10 for LLM Applications** risks:
        1. LLM01:2025 Prompt Injection
        2. LLM02:2025 Sensitive Information Disclosure
        3. LLM03:2025 Supply Chain
        4. LLM04:2025 Data and Model Poisoning
        5. LLM05:2025 Improper Output Handling
        6. LLM06:2025 Excessive Agency
        7. LLM07:2025 System Prompt Leakage
        8. LLM08:2025 Vector and Embedding Weaknesses
        9. LLM09:2025 Misinformation
        10. LLM10:2025 Unbounded Consumption

        You will receive:

        • **LOCAL FUNCTION**  – the code to audit
        • **CALL-FLOW CONTEXT** – snippets of its immediate callers / callees (for reference only)

        ### NON-NEGOTIABLE RULES
        1. If LOCAL FUNCTION is merely a thin wrapper (no extra logic), reply with `{{"issue": "clean"}}`.
        2. Report **only** vulnerabilities that are **inside LOCAL FUNCTION itself**.
        3. Ignore risks that exist *solely* in CALL-FLOW CONTEXT.

        ### TASK
        Return **exactly one line of JSON** with keys:<br>
        `"issue" · "sev" · "fix" · "owasp" · ("mitre" optional)`.<br>
        Use `"issue": "clean"` when no problem is present.

        ### LOCAL FUNCTION ###
        ```python
        {func_src}
        ```

        {flow_src}
    """
    ).strip()

    logger.debug(
        f"Detecting issues in {unit.path} {call.lineno} with LLM prompt:\n{prompt}\n\n"
    )

    try:
        reply = _CLIENT.ask(prompt, max_tokens=180)
    except Exception as exc:
        logger.error("llm_code_audit: provider error %s – skipped", exc)
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

    dedup = (str(unit.path), call.lineno, str(data.get("owasp", "Axx")))
    if dedup in _EMITTED:
        return
    _EMITTED.add(dedup)

    logger.debug(
        "llm_code_audit: found %s (%s) in %s:%s",
        data.get("issue"),
        data.get("sev"),
        unit.path,
        call.lineno,
    )
    yield Finding(
        owasp_id=data.get("owasp", "Axx"),
        mitre=data.get("mitre", []),
        severity=str(data.get("sev", "info")).lower(),
        message=f"LLM audit: {data['issue']}",
        location=unit.path,
        line=call.lineno,
        fix=data.get("fix", ""),
    )
