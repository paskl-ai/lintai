# In lintai/engine/ast_utils.py
import ast


def get_full_attr_name(attr_node: ast.Attribute) -> str:
    """Helper to reconstruct a full dotted name from nested attributes."""
    parts = []
    current_node = attr_node
    while isinstance(current_node, ast.Attribute):
        parts.insert(0, current_node.attr)
        current_node = current_node.value
    if isinstance(current_node, ast.Name):
        parts.insert(0, current_node.id)
    return ".".join(parts)


def get_code_snippet(source_code: str, node: ast.AST) -> str:
    """Safely gets the source code segment for a given AST node."""
    try:
        return ast.get_source_segment(source_code, node) or ""
    except Exception:
        return ""
