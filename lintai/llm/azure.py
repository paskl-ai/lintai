from __future__ import annotations
import json, os, importlib.util, types
from lintai.llm.base import LLMClient
from lintai.llm.token_util import estimate_tokens
from lintai.llm.errors import BudgetExceededError

_spec = importlib.util.find_spec("openai")
openai: types.ModuleType | None = importlib.import_module("openai") if _spec else None

_ERROR_JSON = json.dumps(
    {
        "issue": "Azure provider selected but openai SDK unavailable",
        "sev": "info",
        "fix": "pip install 'lintai[openai]'",
    }
)


class _AzureClient(LLMClient):
    def __init__(self):
        if openai is None or not hasattr(openai, "AzureOpenAI"):
            raise ImportError(_ERROR_JSON)

        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT") or os.getenv("OPENAI_API_BASE")
        key = os.getenv("AZURE_OPENAI_API_KEY")
        version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

        if not (endpoint and key):
            raise ImportError(
                "Azure provider selected but AZURE_OPENAI_ENDPOINT or "
                "AZURE_OPENAI_API_KEY env vars are missing."
            )

        self.client = openai.AzureOpenAI(
            api_key=key,
            api_version=version,
            azure_endpoint=endpoint,
        )
        # deployment name, not model family
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def ask(self, prompt: str, max_tokens: int = 256, **kw) -> str:
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
            return resp.choices[0].message.content
        except BudgetExceededError:
            raise
        except Exception as exc:
            return json.dumps(
                {
                    "issue": f"AzureOpenAI error: {exc.__class__.__name__}",
                    "sev": "info",
                    "fix": "Check endpoint/deployment or API version",
                }
            )


def create():
    return _AzureClient()
