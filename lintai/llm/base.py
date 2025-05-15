from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any

# Define constant at module level
DEFAULT_MAX_CONTEXT_SIZE = 8192


class LLMClient(ABC):
    """
    Minimal interface all providers must implement.
    """

    @abstractmethod
    def ask(self, prompt: str, **kwargs: Any) -> str: ...

    @property
    def max_context(self) -> int:
        return DEFAULT_MAX_CONTEXT_SIZE
