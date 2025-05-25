# lintai/llm/base.py
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any
from decimal import Decimal
import logging
from lintai.llm.budget import manager as _budget
from lintai.llm.token_util import estimate_tokens
from lintai.llm.errors import BudgetExceededError

DEFAULT_MAX_CONTEXT_SIZE = 8192  # fallback for providers that don’t expose this

logger = logging.getLogger(__name__)


class LLMClient(ABC):
    """
    Minimal interface all providers must implement.
    Sub-classes automatically inherit budget / quota enforcement.
    """

    is_dummy: bool = False  # real providers don’t touch it
    model: str = "unknown"  # override in concrete subclasses

    # ------------------------------------------------------------------ #
    # public helpers                                                     #
    # ------------------------------------------------------------------ #
    @property
    def max_context(self) -> int:  # pragma: no cover
        """Override if provider exposes the real value."""
        return DEFAULT_MAX_CONTEXT_SIZE

    # ------------------------------------------------------------------ #
    # convenience: subclasses call this *before* the network roundtrip   #
    # ------------------------------------------------------------------ #
    def _preflight_budget(self, prompt: str, max_completion: int) -> None:
        prompt_tok = estimate_tokens(prompt, self.model)
        if not _budget.allow(prompt_tok, max_completion, self.model):
            raise BudgetExceededError(
                "LLM budget exceeded – set higher limits via "
                "LINTAI_MAX_LLM_* environment variables if needed."
            )
        # store for post-commit
        self._tmp_prompt_tok = prompt_tok
        self._tmp_max_completion = max_completion

    def _post_commit_budget(self, completion_tok: int, real_cost: float | None):
        _budget.commit(
            self._tmp_prompt_tok,
            completion_tok,
            self.model,
            None if real_cost is None else Decimal(str(real_cost)),
        )
        logger.debug(
            "Budget commit: prompt=%s, completion=%s, model=%s, usd=%s",
            self._tmp_prompt_tok,
            completion_tok,
            self.model,
            real_cost,
        )

        # clean-up
        del self._tmp_prompt_tok, self._tmp_max_completion

    # ------------------------------------------------------------------ #
    # abstract interface – provider must call *_budget helpers           #
    # ------------------------------------------------------------------ #
    @abstractmethod
    def ask(self, prompt: str, max_tokens: int, **kwargs: Any) -> str: ...
