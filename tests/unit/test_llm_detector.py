import subprocess, json, pathlib, textwrap, os


def test_llm_detector_offline(tmp_path, monkeypatch):
    # force dummy provider so we don't call network
    monkeypatch.setenv("LINTAI_LLM_PROVIDER", "dummy")
    src = tmp_path / "bot.py"
    src.write_text(
        textwrap.dedent(
            """
        import openai
        openai.ChatCompletion.create(model="gpt-4o-mini", messages=[])
    """
        )
    )
    result = subprocess.run(
        ["lintai", "find-issues", str(src)], capture_output=True, text=True, check=True
    )
    result_obj = json.loads(result.stdout)
    findings = result_obj["findings"]
    # dummy provider returns no JSON → detector yields nothing
    assert not findings
