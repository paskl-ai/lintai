from lintai.detectors import register
from lintai.detectors.base import SourceUnit
from lintai.core.finding import Finding
import logging

logger = logging.getLogger(__name__)

SINK_FUNCS = {"eval", "exec", "subprocess.call", "os.system"}


@register("LLM02", scope="module")
def detect_insecure_output(unit: SourceUnit):
    if not getattr(unit, "is_ai_module", False):
        return

    logger.debug(f">>> Running OWASP LLM02 detector for {unit.path} <<<")

    for call in getattr(unit, "calls", lambda: [])():
        if getattr(call, "full_name", "") in SINK_FUNCS and getattr(
            unit, "is_model_response", lambda x: False
        )(call.argument(0)):
            yield Finding(
                detector_id="LLM02",
                owasp_id="LLM02",
                mitre=["T1059.004"],
                severity="warn",
                message=f"Model response passed to dangerous sink {getattr(call, 'full_name', '')}",
                location=unit.path,
                line=getattr(call, "line", None),
                fix="Validate / sanitise model output or avoid dynamic execution",
            )
