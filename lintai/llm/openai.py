from __future__ import annotations
import json, os, importlib.util, types
from typing import Any
from lintai.llm.base import LLMClient
from lintai.llm.token_util import estimate_tokens
from lintai.llm.errors import BudgetExceededError

# ------------------------------------------------------------------ #
# 1. Optional import
# ------------------------------------------------------------------ #
_spec = importlib.util.find_spec("openai")
openai: types.ModuleType | None = importlib.import_module("openai") if _spec else None

_ERROR_JSON = json.dumps(
    {
        "issue": "OpenAI provider selected but SDK unavailable",
        "sev": "info",
        "fix": "pip install 'lintai[openai]'",
    }
)


# ------------------------------------------------------------------ #
# 2. Helper: create compatibility client
# ------------------------------------------------------------------ #
def _make_client() -> Any:
    """
    Return an object with `.chat.completions.create` no matter which
    openai‑python major version is installed.
    """
    if not openai:  # should never happen – caller checks
        raise ImportError(_ERROR_JSON)

    # >=1.0 has OpenAI() class
    if hasattr(openai, "OpenAI"):
        base = os.getenv(
            "OPENAI_API_BASE"
        ) or os.getenv(  # specific OpenAI API base URL variable
            "LLM_ENDPOINT_URL"
        )  # generic LLM endpoint URL variable
        key = (
            os.getenv("OPENAI_API_KEY")  # specific OpenAI API key variable
            or os.getenv("LLM_API_KEY")  # generic LLM API key variable
            or ""
        )
        return openai.OpenAI(api_key=key or None, base_url=base or None)

    # 0.x – module‑level functions
    return openai  # type: ignore[return-value]


# ------------------------------------------------------------------ #
# 3. Provider implementation
# ------------------------------------------------------------------ #
class _OpenAIClient(LLMClient):
    def __init__(self):
        if openai is None:
            raise ImportError(_ERROR_JSON)
        self.client = _make_client()
        self.model = (
            os.getenv("OPENAI_MODEL")  # specific OpenAI model variable
            or os.getenv("LLM_MODEL_NAME")  # generic LLM model name variable
            or "gpt-4.1-mini"  # default model
        )

    def ask(
        self, prompt: str, max_tokens: int = 256, **kw
    ) -> str:  # kw: temperature, max_tokens ...
        try:
            # ①  budget check
            self._preflight_budget(prompt, max_tokens)

            # ②  call provider and get response
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=kw.get("temperature", 0.2),
                response_format={"type": "json_object"},
            )
            message = (
                resp.choices[0].message.content
                if hasattr(resp.choices[0], "message")
                else resp.choices[0]["message"]["content"]  # 0.x dict
            )

            # ③  extract usage for *real* accounting
            usage = getattr(resp, "usage", None)
            completion_tok = (
                usage.completion_tokens
                if usage
                else estimate_tokens(resp.choices[0].message.content, self.model)
            )
            cost_usd = None  # OpenAI API v2 doesn’t return cost – leave None

            # ④  commit to budget
            self._post_commit_budget(completion_tok, cost_usd)

            # ⑤  return the message content
            return message
        except BudgetExceededError:
            raise
        except Exception as exc:
            # Surface a JSON stub so detector won't crash the scan
            return json.dumps(
                {
                    "issue": f"OpenAI SDK error: {exc.__class__.__name__}",
                    "sev": "info",
                    "fix": "Check OPENAI_API_KEY / network or pin openai<1.0",
                }
            )


def create():
    return _OpenAIClient()
