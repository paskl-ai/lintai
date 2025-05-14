from __future__ import annotations
import json, os, importlib.util, types
from typing import Any
from lintai.llm.base import LLMClient

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
    if not openai:                   # should never happen – caller checks
        raise ImportError(_ERROR_JSON)

    # >=1.0 has OpenAI() class
    if hasattr(openai, "OpenAI"):
        base = os.getenv("OPENAI_API_BASE")
        key = os.getenv("OPENAI_API_KEY", "")
        return openai.OpenAI(api_key=key or None, base_url=base or None)

    # 0.x – module‑level functions
    return openai                    # type: ignore[return-value]


# ------------------------------------------------------------------ #
# 3. Provider implementation
# ------------------------------------------------------------------ #
class _OpenAIClient(LLMClient):
    def __init__(self):
        if openai is None:
            raise ImportError(_ERROR_JSON)
        self.client = _make_client()
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def ask(self, prompt: str, **kw) -> str:  # kw: temperature, max_tokens ...
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kw.get("max_tokens", 256),
                temperature=kw.get("temperature", 0.2),
                response_format={"type": "json_object"},
            )
            # object shape differs slightly; normalize
            message = (
                resp.choices[0].message.content
                if hasattr(resp.choices[0], "message")
                else resp.choices[0]["message"]["content"]  # 0.x dict
            )
            return message
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
