from lintai.components.langchain import LANGCHAIN_COMPONENTS
from lintai.components.autogen import AUTOGEN_COMPONENTS
from lintai.components.crewai import CREWAI_COMPONENTS
from lintai.components.dspy import DSPY_COMPONENTS

# Merge all known mappings
SINK_TYPE_MAP = {
    **LANGCHAIN_COMPONENTS,
    **AUTOGEN_COMPONENTS,
    **CREWAI_COMPONENTS,
    **DSPY_COMPONENTS,
}

def classify_sink(sink: str) -> str:
    for key in SINK_TYPE_MAP:
        if key in sink:
            return SINK_TYPE_MAP[key]
    return "Unknown"

