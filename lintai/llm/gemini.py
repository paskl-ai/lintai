import os, json, importlib.util
from lintai.llm.base import LLMClient
from lintai.llm.token_util import estimate_tokens
from lintai.llm.errors import BudgetExceededError

_spec = importlib.util.find_spec("google.generativeai")
genai = importlib.util.module_from_spec(_spec) if _spec else None
if _spec:
    _spec.loader.exec_module(genai)

_ERROR_JSON = json.dumps(
    {
        "issue": "Gemini provider selected but SDK unavailable",
        "sev": "info",
        "fix": "pip install 'lintai[gemini]'",
    }
)


class _GeminiClient(LLMClient):
    def __init__(self):
        if genai is None:
            raise ImportError(_ERROR_JSON)
        key = os.getenv(
            "GOOGLE_API_KEY"
        ) or os.getenv(  # specific Google Gemini API key variable
            "LLM_API_KEY"
        )  # generic LLM API key variable

        if not key:
            raise ImportError("GOOGLE_API_KEY env var missing")
        genai.configure(api_key=key)
        self.model = genai.GenerativeModel(
            os.getenv("GEMINI_MODEL")  # specific Gemini model variable
            or os.getenv("LLM_MODEL_NAME")  # generic LLM model name variable
            or "gemini-pro"  # default model
        )

    def ask(
        self, prompt: str, max_tokens: int = 256, **kw
    ) -> str:  # kw: temperature, max_tokens ...
        try:
            # ①  budget check
            self._preflight_budget(prompt, max_tokens)

            # ②  call provider and get response
            resp = self.model.generate_content(
                prompt,
                generation_config={"max_output_tokens": max_tokens},
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
            return resp.text
        except BudgetExceededError:
            raise
        except Exception as exc:
            return json.dumps(
                {
                    "issue": f"Gemini error: {exc.__class__.__name__}",
                    "sev": "info",
                    "fix": "Check Google API key or limits",
                }
            )


def create():
    return _GeminiClient()
