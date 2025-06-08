from lintai.engine.frameworks import detect_frameworks
from lintai.engine.component_types import classify_sink

import ast


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
        sink = sink_entry.get("sink")
        at = sink_entry.get("at")
        comp_type = classify_sink(sink)

        components.append({
            "type": comp_type,
            "sink": sink,
            "at": at
        })

    # From static AST-based detection
    additional = extract_ast_components(tree, file_path)
    components.extend(additional)

    return {
        "file": file_path,
        "frameworks": frameworks,
        "components": components
    }


def extract_ast_components(ast_tree, file_path):
    """Extract components from AST that are not dynamic AI sinks (e.g., tools, agents, chains)."""
    components = []

    for node in ast.walk(ast_tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                # e.g., AssistantAgent(...)
                class_name = node.func.id
                components.append({
                    "type": classify_sink(class_name),
                    "sink": class_name,
                    "at": f"{file_path}:{node.lineno}"
                })

            elif isinstance(node.func, ast.Attribute):
                try:
                    full_name = get_full_attr_name(node.func)

                    # Filter out calls like `x.close()` where `x` is a local variable
                    if "." in full_name:
                        root = full_name.split(".")[0]
                        if root.islower():  # crude heuristic: likely a variable
                            continue

                    components.append({
                        "type": classify_sink(full_name),
                        "sink": full_name,
                        "at": f"{file_path}:{node.lineno}"
                    })

                except Exception:
                    continue

    return components


def get_full_attr_name(attr):
    """Helper to reconstruct full dotted name from nested attributes."""
    parts = []
    while isinstance(attr, ast.Attribute):
        parts.insert(0, attr.attr)
        attr = attr.value
    if isinstance(attr, ast.Name):
        parts.insert(0, attr.id)
    return ".".join(parts)

