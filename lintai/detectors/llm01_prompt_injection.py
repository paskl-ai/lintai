from lintai.detectors import register
from lintai.detectors.base import SourceUnit
from lintai.core.finding import Finding

@register("LLM01")
def detect_prompt_injection(unit: SourceUnit):
    print(">>> Running OWASP LLM01 detector")

    for fstr in unit.joined_fstrings():
        if unit.is_user_tainted(fstr) and not unit.has_call("sanitize", fstr):
            yield Finding(
                owasp_id="LLM01",
                mitre=["T1059"],
                severity="blocker",
                message="User‑tainted f‑string used in LLM prompt without sanitisation",
                location=unit.path,
                line=getattr(fstr, "lineno", None),
                fix="Wrap variable in sanitize() or escape()"
            )
