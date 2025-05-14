import ast, re

# Common provider libs & frameworks
_IMPORT_PAT = re.compile(
    r"\b(openai|litellm|langchain|anthropic|google\.generativeai|cohere"
    r"|llama_index|guidance|gpt4all|ollama)\b",
    re.I,
)
_CALL_PAT = re.compile(
    r"\b(chat|completions?|generate|run|predict|invoke|stream)_?", re.I
)


def is_hot_import(node: ast.AST) -> bool:
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        return any(_IMPORT_PAT.search(n.name) for n in node.names)
    return False


def is_hot_call(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call):
        return False
    # attr, Name, or Call.attr chain (e.g., client.chat())
    name_parts = []
    cur = node.func
    while isinstance(cur, ast.Attribute):
        name_parts.append(cur.attr)
        cur = cur.value
    if isinstance(cur, ast.Name):
        name_parts.append(cur.id)
    dotted = ".".join(reversed(name_parts))
    return bool(_CALL_PAT.search(dotted) or _IMPORT_PAT.search(dotted))
