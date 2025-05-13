import os, anthropic
from lintai.llm.base import LLMClient

class _AnthropicClient(LLMClient):
    def __init__(self):
        anthropic.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet-20240229")

    def ask(self, prompt, **kw):
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=kw.get("max_tokens", 256),
        )
        return resp.content[0].text

def create():
    return _AnthropicClient()
