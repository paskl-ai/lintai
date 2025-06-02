import re
import ast
import logging
from lintai.detectors import register
from lintai.detectors.base import SourceUnit
from lintai.core.finding import Finding

logger = logging.getLogger(__name__)

# Regex patterns for basic PII detection
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
SSN_REGEX = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


@register("PII01", scope="module")
def detect_pii_leak(unit: SourceUnit):
    """
    Detects f-strings embedding PII (emails or SSNs) directly in AI prompts.
    """
    # Only analyze modules identified as AI-related
    if not getattr(unit, "is_ai_module", False):
        return

    logger.debug(f"Running PII detector for {unit.path}")

    for fstr in unit.joined_fstrings():
        for part in fstr.values:
            # catch not only constant text, but also FormattedValue (the {…} parts)
            if isinstance(part, ast.FormattedValue):
                # get the actual variable name(s) used
                expr = part.value
                if isinstance(expr, ast.Name) and re.search(
                    r"(SSN|EMAIL)", expr.id, re.IGNORECASE
                ):
                    yield Finding(
                        detector_id="PII01",
                        owasp_id="PII01: PII Exposure",
                        mitre=["TA0010"],  # Exfiltration
                        severity="blocker",
                        message=(
                            "Embedding PII (email or SSN) directly into LLM prompt "
                            "exposes sensitive data."
                        ),
                        location=unit.path,
                        line=fstr.lineno,
                        fix="Remove or mask PII variables before embedding in prompts.",
                    )
