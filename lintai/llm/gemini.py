import os, json, importlib.util
from lintai.llm.base import LLMClient

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
        key = os.getenv("GOOGLE_API_KEY")
        if not key:
            raise ImportError("GOOGLE_API_KEY env var missing")
        genai.configure(api_key=key)
        self.model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-pro"))

    def ask(self, prompt, **kw):
        try:
            resp = self.model.generate_content(
                prompt,
                generation_config={"max_output_tokens": kw.get("max_tokens", 256)},
            )
            return resp.text
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
