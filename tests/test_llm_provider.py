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
    # ensure import fails
    monkeypatch.setitem(sys.modules, "openai", None)

    import lintai.llm as llm_mod
    import importlib

    importlib.reload(llm_mod)

    with pytest.raises(SystemExit):  # CLI path
        llm_mod.get_client()
