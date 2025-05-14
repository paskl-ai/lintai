import ast, json, logging, textwrap, re
from lintai.detectors import register
from lintai.core.finding import Finding
from lintai.engine.ai_tags import is_hot_call
from lintai.llm import get_client

logger = logging.getLogger(__name__)
_CLIENT = get_client()  # dummy if no key / provider error

_CODE_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)


def _extract_json(txt: str) -> str | None:
    """
    Return the JSON fragment inside txt, stripping ```json … ```,
    or None if not found.
    """
    m = _CODE_RE.search(txt)
    if m:
        return m.group(1).strip()
    # maybe the model returned raw one‑liner without code block
    raw = txt.strip()
    return raw if raw.startswith("{") and raw.endswith("}") else None


# JSON issue prefixes that mean “this was a stub or error, ignore”
_IGNORE_PREFIXES = (
    "llm detection disabled",
    "llm disabled",
    "openai provider selected but",
    "openai sdk error",
    "openai sdk unavailable",
    "openai provider selected but sdk unavailable",
)


@register("AI_LLM01", scope="node", node_types=(ast.Call,))
def llm_audit(unit):
    call = unit._current
    if not is_hot_call(call):
        return

    snippet = (
        ast.get_source_segment(getattr(unit, "source", ""), call)
        or "<code unavailable>"
    )
    prompt = textwrap.dedent(
        f"""
        As a secure‑coding assistant, identify any OWASP GenAI risks
        in the following code.  Return *one‑line* JSON with keys
        "issue", "sev", "fix", "owasp", and optional "mitre" (list).
        ```python
        {snippet}
        ```
    """
    )

    try:
        reply = _CLIENT.ask(prompt, max_tokens=180)
    except Exception as exc:
        logger.debug("LLM provider raised %s — skipping audit", exc.__class__.__name__)
        return

    payload = _extract_json(reply)
    if not payload:
        logger.debug("LLM reply not JSON: %r … skipping", reply[:80])
        return

    try:
        data = json.loads(payload)
    except Exception:
        logger.debug("LLM reply not JSON: %r … skipping", reply[:80])
        return

    # Early‑exit if this is a diagnostic / stub payload
    issue_txt = str(data.get("issue", "")).lower()
    if any(issue_txt.startswith(pfx) for pfx in _IGNORE_PREFIXES):
        logger.debug("LLM audit benign message: %s … skipping", issue_txt)
        return

    # Required keys check
    if "issue" not in data or "sev" not in data or "fix" not in data:
        logger.debug("LLM reply missing required keys: %s", data)
        return

    mitre = data.get("mitre", [])
    if isinstance(mitre, str):
        mitre = [mitre]

    yield Finding(
        owasp_id=data.get("owasp", "Axx"),
        mitre=mitre,  # may be empty list – OK
        severity=data["sev"],
        message=f"LLM audit: {data['issue']}",
        location=unit.path,
        line=call.lineno,
        fix=data["fix"],
    )
