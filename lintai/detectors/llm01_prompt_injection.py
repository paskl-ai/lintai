from lintai.detectors import register
from lintai.detectors.base import SourceUnit
from lintai.core.finding import Finding
import logging

logger = logging.getLogger(__name__)


@register("LLM01", scope="module")
def detect_prompt_injection(unit: SourceUnit):
    if not getattr(unit, "is_ai_module", False):
        return

    logger.debug(f">>> Running OWASP LLM01 detector for {unit.path} <<<")

    for fstr in unit.joined_fstrings():
        if unit.is_user_tainted(fstr) and not unit.has_call("sanitize", fstr):
            yield Finding(
                owasp_id="LLM01:2025 Prompt Injection",
                mitre=["T1059"],
                severity="blocker",
                message="Unsanitized user input string used in LLM prompt",
                location=unit.path,
                line=getattr(fstr, "lineno", None),
                fix="Wrap variable in sanitize() or escape()",
            )
