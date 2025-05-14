from __future__ import annotations
import os, importlib, logging, sys
from typing import Dict
from lintai.llm.base import LLMClient

logger = logging.getLogger(__name__)

_PROVIDERS: Dict[str, str] = {
    # provider‑id → module path
    "openai": "lintai.llm.openai",
    "azure": "lintai.llm.azure",
    "anthropic": "lintai.llm.anthropic",
    "claude": "lintai.llm.anthropic",
    "gemini": "lintai.llm.gemini",
    "cohere": "lintai.llm.cohere",
    "dummy": "lintai.llm.dummy",
}


def get_client() -> LLMClient:
    choice = os.getenv("LINTAI_LLM_PROVIDER", "dummy").lower()
    module_path = _PROVIDERS.get(choice, _PROVIDERS["dummy"])

    try:
        mod = importlib.import_module(module_path)
        return mod.create()
    except ImportError as exc:
        # Surface friendly error & exit non‑zero for CLI; re‑raise for library use
        msg = (
            f"{choice!r} provider chosen but its SDK is missing.\n"
            f"{exc}\nInstall via  ➜   pip install 'lintai[{choice}]'"
        )
        if "lintai.cli" in sys.modules:  # running in CLI context
            logger.error(msg)
            raise SystemExit(2)
        raise
