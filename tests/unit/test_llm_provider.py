import importlib, json, sys, pytest
from lintai.llm import get_client


def test_dummy_provider_default(monkeypatch):
    monkeypatch.delenv("LINTAI_LLM_PROVIDER", raising=False)
    cl = get_client()
    payload = json.loads(cl.ask("hi"))
    assert payload["issue"].startswith("LLM detection disabled")


def test_openai_provider_select(monkeypatch):
    # 1. select the provider via env
    monkeypatch.setenv("LINTAI_LLM_PROVIDER", "openai")

    # 2. reload lintai.llm so it re‑reads the env var
    import lintai.llm as llm_mod

    importlib.reload(llm_mod)

    # 3. import the provider sub‑module *after* the reload
    import lintai.llm.openai as oai

    # 4. monkey‑patch the factory to avoid a network call
    class Fake(oai._OpenAIClient):
        def __init__(self):
            pass

        def ask(self, prompt, **kw):
            return "hello"

    monkeypatch.setattr(oai, "create", lambda: Fake())

    # 5. get a client and assert the stub works
    cl = llm_mod.get_client()
    assert cl.ask("ping") == "hello"


def test_openai_provider_requires_sdk(monkeypatch):
    monkeypatch.setenv("LINTAI_LLM_PROVIDER", "openai")

    # Remove 'openai' from sys.modules to simulate ImportError
    sys.modules.pop("openai", None)

    # Reload the openai client module to re-evaluate the import block
    import lintai.llm.openai as llm_openai

    importlib.reload(llm_openai)

    # Explicitly patch the `openai` symbol to None inside the module
    monkeypatch.setattr(llm_openai, "openai", None)

    # Reload lintai.llm to re-trigger provider loading
    import lintai.llm as llm_mod

    importlib.reload(llm_mod)

    # Ensure it exits when trying to get the provider
    with pytest.raises(SystemExit):
        llm_mod.get_client()
