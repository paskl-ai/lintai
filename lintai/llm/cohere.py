import os, json, importlib.util
from lintai.llm.base import LLMClient

_spec = importlib.util.find_spec("cohere")
cohere = importlib.util.module_from_spec(_spec) if _spec else None
if _spec:
    _spec.loader.exec_module(cohere)

_ERROR_JSON = json.dumps(
    {
        "issue": "Cohere provider selected but SDK unavailable",
        "sev": "info",
        "fix": "pip install 'lintai[cohere]'",
    }
)


class _CohereClient(LLMClient):
    def __init__(self):
        if cohere is None:
            raise ImportError(_ERROR_JSON)
        key = os.getenv("COHERE_API_KEY")
        if not key:
            raise ImportError("COHERE_API_KEY env var missing")
        self.client = cohere.Client(key)
        self.model = os.getenv("COHERE_MODEL", "command-r")

    def ask(self, prompt, **kw):
        try:
            out = self.client.chat(
                model=self.model, message=prompt, max_tokens=kw.get("max_tokens", 256)
            )
            return out.text
        except Exception as exc:
            return json.dumps(
                {
                    "issue": f"Cohere error: {exc.__class__.__name__}",
                    "sev": "info",
                    "fix": "Check Cohere API key or rate limits",
                }
            )


def create():
    return _CohereClient()
