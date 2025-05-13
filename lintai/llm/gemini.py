import os, google.generativeai as genai
from lintai.llm.base import LLMClient

class _GeminiClient(LLMClient):
    def __init__(self):
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        self.model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-pro"))

    def ask(self, prompt, **kw):
        resp = self.model.generate_content(prompt, generation_config={"max_output_tokens": kw.get("max_tokens",256)})
        return resp.text

def create(): return _GeminiClient()
