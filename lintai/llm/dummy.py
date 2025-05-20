import json
from lintai.llm.base import LLMClient

_OFFLINE_JSON = json.dumps(
    {
        "issue": "LLM detection disabled",
        "sev": "info",
        "fix": "Enable provider or ignore",
    }
)


def create():
    class _Dummy(LLMClient):
        is_dummy = True

        def ask(self, prompt, **kw):
            return _OFFLINE_JSON

    return _Dummy()
