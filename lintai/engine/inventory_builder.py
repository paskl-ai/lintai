from .frameworks import detect_frameworks
from .component_types import classify_sink
import ast


def build_inventory(file_path, ai_sinks):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read())
    except Exception as e:
        return {"file": file_path, "error": str(e), "components": []}

    frameworks = detect_frameworks(tree)
    components = []

    for sink_entry in ai_sinks:
        sink = sink_entry.get("sink")
        at = sink_entry.get("at")
        comp_type = classify_sink(sink)

        components.append({"type": comp_type, "sink": sink, "at": at})

    return {"file": file_path, "frameworks": frameworks, "components": components}
