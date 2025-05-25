# lintai/llm/token_util.py
from __future__ import annotations
import logging

log = logging.getLogger(__name__)

# optional dependency – fall back gracefully
try:
    import tiktoken
except ModuleNotFoundError:  # pragma: no cover
    tiktoken = None

_CL100K = None
if tiktoken:
    try:
        _CL100K = tiktoken.get_encoding("cl100k_base")
    except Exception:  # pragma: no cover
        pass


def estimate_tokens(text: str, model_hint: str | None = None) -> int:
    """
    Best-effort token estimator.

    1.  If *tiktoken* is available & knows the model, use that.
    2.  Else fall back to `cl100k_base` (handles GPT-4/-3.5 roughly).
    3.  Else len(text) // 4 heuristic.
    """
    if not tiktoken:
        return max(1, len(text) // 4)

    try:
        enc = (
            tiktoken.encoding_for_model(model_hint) if model_hint else None  # fast path
        )
    except KeyError:
        enc = None

    if not enc:
        enc = _CL100K

    if enc:
        try:
            return len(enc.encode(text))
        except Exception:  # defensive
            pass

    return max(1, len(text) // 4)
