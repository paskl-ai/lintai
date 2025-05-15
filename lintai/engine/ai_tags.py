"""
Identify “hot” Gen-AI imports & calls.
Over-include on purpose so later detectors can filter.
"""

from __future__ import annotations
import ast
import logging
import re
from typing import Set

# ---------------------------------------------------------------------------
# 1.  Regexes
# ---------------------------------------------------------------------------
# Provider / framework names (fully-qualified or top-level)
_PROVIDER_RX = re.compile(
    r"""
        \b(
            openai
          | anthropic
          | google\.generativeai
          | ai21
          | cohere
          | together_ai?
          | mistral
          | ollama
          | llama_index
          | litellm
          | langchain
          | langgraph
          | guidance
          | gpt4all
          | autogen
          | autogpt
          | crewai
          | chromadb
          | pinecone
          | weaviate
        )\b
    """,
    re.I | re.X,
)

# Action verbs commonly seen on LLM / embedding objects
_VERB_RX = re.compile(
    r"""
        \b(
            chat
          | complete|completions?
          | generate|predict
          | invoke|run|call|answer|ask
          | stream|streaming
          | embed|embedding|embeddings
          | encode|decode
          | transform|translate|summar(y|ize)
          | agent(_run)?
        )_?
    """,
    re.I | re.X,
)

# ---------------------------------------------------------------------------
# 2.  “Hot” import detection
# ---------------------------------------------------------------------------
_seen_import_nodes: Set[int] = set()  # guard against double logging


def is_hot_import(node: ast.AST) -> bool:
    """True if this Import/ImportFrom brings in a Gen-AI provider."""
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        if id(node) not in _seen_import_nodes:  # optional debug
            _seen_import_nodes.add(id(node))
            logging.getLogger(__name__).debug(
                "IMPORT   %s", ast.get_source_segment(node._unit.source, node)  # type: ignore[attr-defined]
            )
        return any(_PROVIDER_RX.search(alias.name) for alias in node.names)
    return False


# ---------------------------------------------------------------------------
# 3.  “Hot” call detection
# ---------------------------------------------------------------------------
def _attr_chain(expr: ast.AST) -> list[str]:
    """
    Convert   client.chat.completions.create
    into      ["client", "chat", "completions", "create"].
    """
    parts: list[str] = []
    while isinstance(expr, ast.Attribute):
        parts.append(expr.attr)
        expr = expr.value
    if isinstance(expr, ast.Name):
        parts.append(expr.id)
    return list(reversed(parts))  # root … leaf


def is_hot_call(node: ast.AST) -> bool:
    """
    A call is “hot” when EITHER:
    • any segment of its dotted path contains a provider name, OR
    • the final segment matches an LLM verb (chat, generate, …).

    (We do *not* try to resolve aliases or assignments.)
    """
    if not isinstance(node, ast.Call):
        return False

    parts = _attr_chain(node.func)
    dotted = ".".join(parts)
    logging.getLogger(__name__).debug("CALL     %s", dotted)

    return bool(_PROVIDER_RX.search(dotted) or _VERB_RX.search(parts[-1]))
