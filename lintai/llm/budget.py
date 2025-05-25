# lintai/llm/budget.py
from __future__ import annotations
import os, threading
from contextlib import contextmanager
from decimal import Decimal
from typing import Optional, Final

# --------------------------------------------------------------------------- #
# helper: price table  (USD / 1000 tok)                                        #
# --------------------------------------------------------------------------- #
# Keep this coarse - we only need an order-of-magnitude estimate.
# You can override/extend via env LINTAI_PRICE_TABLE=json
_DEFAULT_PRICES: Final[dict[str, Decimal]] = {
    "gpt-4o": Decimal("0.005"),
    "gpt-4": Decimal("0.03"),
    "gpt-3.5": Decimal("0.001"),
    "claude-3": Decimal("0.008"),
    "claude-2": Decimal("0.008"),
    "gemini": Decimal("0.001"),
    "command-r": Decimal("0.002"),  # Cohere
}

# --------------------------------------------------------------------------- #
# helpers                                                                     #
# --------------------------------------------------------------------------- #

_KILO = Decimal("1000")  # one place only


def _usd_for_tokens(tokens: int, model: str) -> Decimal:
    """
    Convert *tokens* to a *Decimal* USD cost for *model* using the price table.
    Keeps all math in `Decimal` to avoid float/Decimal TypeErrors.
    """
    return (Decimal(tokens) / _KILO) * _price_for(model)


def _price_for(model: str) -> Decimal:
    model = model.lower()
    for prefix, usd in _DEFAULT_PRICES.items():
        if model.startswith(prefix):
            return usd
    return Decimal("0.002")  # safe default


# --------------------------------------------------------------------------- #
# main manager                                                                 #
# --------------------------------------------------------------------------- #
class BudgetManager:
    """
    Thread-safe singleton that tracks tokens / cost / request count **for the
    whole Lintai run**. Limits are configurable via environment variables:

      LINTAI_MAX_LLM_TOKENS      (int, default 50 000)
      LINTAI_MAX_LLM_COST_USD    (float, default 10.00)
      LINTAI_MAX_LLM_REQUESTS    (int, default 500)
    """

    def __init__(self) -> None:
        self._tok_used = 0
        self._usd_used = Decimal("0")
        self._req_used = 0
        self._lock = threading.Lock()
        self.reload()  # <─ read env the first time

    def reload(self) -> None:
        """(Re)read max_* limits from os.environ."""
        self.max_tokens = int(os.getenv("LINTAI_MAX_LLM_TOKENS", "50000"))
        self.max_cost_usd = Decimal(os.getenv("LINTAI_MAX_LLM_COST_USD", "10"))
        self.max_requests = int(os.getenv("LINTAI_MAX_LLM_REQUESTS", "500"))

    # ──────────────────────────────────────────────────────────────────────
    #  public helpers
    # ──────────────────────────────────────────────────────────────────────
    def allow(self, est_prompt_tok: int, est_completion_tok: int, model: str) -> bool:
        """Return True if the *estimate* would stay within budget."""
        est_cost = _usd_for_tokens(est_prompt_tok + est_completion_tok, model)
        with self._lock:
            if (
                self._tok_used + est_prompt_tok + est_completion_tok > self.max_tokens
                or self._usd_used + est_cost > self.max_cost_usd
                or self._req_used + 1 > self.max_requests
            ):
                return False
            return True

    def commit(
        self,
        prompt_tok: int,
        completion_tok: int,
        model: str,
        real_cost_usd: Optional[Decimal] = None,
    ) -> None:
        """Record *actual* usage once a call returns."""
        with self._lock:
            self._tok_used += prompt_tok + completion_tok
            self._usd_used += (
                real_cost_usd
                if real_cost_usd is not None
                else _usd_for_tokens(prompt_tok + completion_tok, model)
            )
            self._req_used += 1

    # handy wrapper – useful if you need manual guard outside the client
    @contextmanager
    def guard(self, est_prompt_tok: int, est_completion_tok: int, model: str):
        ok = self.allow(est_prompt_tok, est_completion_tok, model)
        yield ok
        # detectors don’t commit – only the LLM client does afterwards.

    # diagnostic
    def snapshot(self) -> dict:
        with self._lock:
            return {
                "tokens_used": self._tok_used,
                "usd_used": float(self._usd_used),
                "requests": self._req_used,
                "limits": {
                    "tokens": self.max_tokens,
                    "usd": float(self.max_cost_usd),
                    "requests": self.max_requests,
                },
            }


# ---- module-level singleton -------------------------------------------------
manager = BudgetManager()
