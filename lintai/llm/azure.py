from __future__ import annotations
import json, os, importlib.util, types
from lintai.llm.base import LLMClient

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
        key      = os.getenv("AZURE_OPENAI_API_KEY")
        version  = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

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

    def ask(self, prompt: str, **kw) -> str:
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kw.get("max_tokens", 256),
                temperature=kw.get("temperature", 0.2),
            )
            return resp.choices[0].message.content
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
