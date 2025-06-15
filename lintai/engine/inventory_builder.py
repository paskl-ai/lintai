import ast
from lintai.engine.frameworks import detect_frameworks
from lintai.engine.component_types import classify_sink, NOISE_SINKS


def build_inventory(file_path, ai_sinks):
    """
    Build a structured inventory from both dynamic AI call graph analysis
    and static AST inspection.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read())
    except Exception as e:
        return {"file": file_path, "error": str(e), "components": []}

    frameworks = detect_frameworks(tree)
    components = []

    # From dynamic AI sink detection
    for sink_entry in ai_sinks:
        sink = sink_entry["sink"]
        if classify_sink(sink) == "Ignore":
            continue
        components.append(
            {"type": classify_sink(sink), "sink": sink, "at": sink_entry["at"]}
        )

    # From static AST-based detection
    components.extend(
        c for c in extract_ast_components(tree, file_path) if c["type"] != "Ignore"
    )

    return {"file": file_path, "frameworks": frameworks, "components": components}


def extract_ast_components(tree: ast.AST, file_path: str):
    """Find agents/tools/prompts/exec in plain AST."""
    comps = []

    for node in ast.walk(tree):
        # ---- prompt = "…" or f"…"
        if isinstance(node, ast.Assign):
            for tgt in node.targets:
                if (
                    isinstance(tgt, ast.Name)
                    and "prompt" in tgt.id.lower()
                    and isinstance(node.value, (ast.Constant, ast.JoinedStr))
                ):
                    comps.append(
                        {
                            "type": "Prompt",
                            "sink": tgt.id,
                            "at": f"{file_path}:{node.lineno}",
                        }
                    )

        # ---- Calls (Name or Attribute)
        if not isinstance(node, ast.Call):
            continue

        if isinstance(node.func, ast.Name):
            name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            name = get_full_attr_name(node.func)
        else:
            continue

        # Skip obvious noise
        if name.split(".")[-1] in NOISE_SINKS:
            continue

        comps.append(
            {
                "type": classify_sink(name),
                "sink": name,
                "at": f"{file_path}:{node.lineno}",
            }
        )

    return comps


def get_full_attr_name(attr: ast.Attribute) -> str:
    """Helper to reconstruct full dotted name from nested attributes."""
    parts = []
    while isinstance(attr, ast.Attribute):
        parts.insert(0, attr.attr)
        attr = attr.value
    if isinstance(attr, ast.Name):
        parts.insert(0, attr.id)
    return ".".join(parts)
