from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any

# Define constant at module level
DEFAULT_MAX_CONTEXT_SIZE = 8192


class LLMClient(ABC):
    """
    Minimal interface all providers must implement.
    """

    is_dummy: bool = False  # real providers don’t touch it

    @abstractmethod
    def ask(self, prompt: str, **kwargs: Any) -> str: ...

    @property
    def max_context(self) -> int:
        return DEFAULT_MAX_CONTEXT_SIZE
