import os, json, importlib.util
from lintai.llm.base import LLMClient

_spec = importlib.util.find_spec("anthropic")
anthropic = importlib.util.module_from_spec(_spec) if _spec else None
if _spec:
    _spec.loader.exec_module(anthropic)

_ERROR_JSON = json.dumps({
    "issue": "Anthropic provider selected but SDK unavailable",
    "sev": "info",
    "fix": "pip install 'lintai[anthropic]'",
})

class _AnthropicClient(LLMClient):
    def __init__(self):
        if anthropic is None:
            raise ImportError(_ERROR_JSON)
        key = os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise ImportError("ANTHROPIC_API_KEY env var missing")
        self.client = anthropic.Anthropic(api_key=key)
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet-20240229")

    def ask(self, prompt, **kw):
        try:
            resp = self.client.messages.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kw.get("max_tokens", 256),
                temperature=kw.get("temperature", 0.2),
            )
            return resp.content[0].text
        except Exception as exc:
            return json.dumps({
                "issue": f"Anthropic error: {exc.__class__.__name__}",
                "sev": "info",
                "fix": "Check API key, model, or rate limits",
            })

def create():
    return _AnthropicClient()
