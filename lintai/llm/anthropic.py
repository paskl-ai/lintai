import os, json, importlib.util
from lintai.llm.base import LLMClient
from lintai.llm.token_util import estimate_tokens
from lintai.llm.errors import BudgetExceededError

_spec = importlib.util.find_spec("anthropic")
anthropic = importlib.util.module_from_spec(_spec) if _spec else None
if _spec:
    _spec.loader.exec_module(anthropic)

_ERROR_JSON = json.dumps(
    {
        "issue": "Anthropic provider selected but SDK unavailable",
        "sev": "info",
        "fix": "pip install 'lintai[anthropic]'",
    }
)


class _AnthropicClient(LLMClient):
    def __init__(self):
        if anthropic is None:
            raise ImportError(_ERROR_JSON)
        key = os.getenv(
            "ANTHROPIC_API_KEY"
        ) or os.getenv(  # specific Anthropic API key variable
            "LLM_API_KEY"
        )  # generic LLM API key variable

        if not key:
            raise ImportError("ANTHROPIC_API_KEY env var missing")
        self.client = anthropic.Anthropic(api_key=key)
        self.model = (
            os.getenv("ANTHROPIC_MODEL")  # specific Anthropic model variable
            or os.getenv("LLM_MODEL_NAME")  # generic LLM model name variable
            or "claude-3-sonnet-20240229"  # default model
        )

    def ask(
        self, prompt: str, max_tokens: int = 256, **kw
    ) -> str:  # kw: temperature, max_tokens ...
        try:
            # ①  budget check
            self._preflight_budget(prompt, max_tokens)

            # ②  call provider and get response
            resp = self.client.messages.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=kw.get("temperature", 0.2),
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
            return resp.content[0].text
        except BudgetExceededError:
            raise
        except Exception as exc:
            return json.dumps(
                {
                    "issue": f"Anthropic error: {exc.__class__.__name__}",
                    "sev": "info",
                    "fix": "Check API key, model, or rate limits",
                }
            )


def create():
    return _AnthropicClient()
