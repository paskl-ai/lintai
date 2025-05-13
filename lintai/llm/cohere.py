import os, cohere
from lintai.llm.base import LLMClient

class _CohereClient(LLMClient):
    def __init__(self):
        self.co = cohere.Client(os.getenv("COHERE_API_KEY"))
        self.model = os.getenv("COHERE_MODEL", "command-r")

    def ask(self, prompt, **kw):
        out = self.co.chat(model=self.model, message=prompt, max_tokens=kw.get("max_tokens",256))
        return out.text

def create(): return _CohereClient()
