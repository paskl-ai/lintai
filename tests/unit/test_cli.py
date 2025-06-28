import os
from pathlib import Path
from lintai.cli import app
from typer.testing import CliRunner
import json


def test_cli_runs(tmp_path, monkeypatch):
    dummy = tmp_path / "foo.py"
    dummy.write_text("print('hello')")
    output_file = tmp_path / "report.json"

    # Set environment variable
    monkeypatch.setenv("LINTAI_LLM_PROVIDER", "dummy")

    # Test the CLI command directly using subprocess to avoid Click testing issues
    import subprocess
    import sys

    cmd = [
        sys.executable,
        "-m",
        "lintai.cli",
        "scan",
        str(tmp_path),
        "--output",
        str(output_file),
    ]

    result = subprocess.run(
        cmd,
        cwd=tmp_path.parent.parent,  # Run from project root
        env={**os.environ, "LINTAI_LLM_PROVIDER": "dummy"},
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert output_file.exists()


def test_inventory_shows_call_chain_and_relationships(tmp_path):
    code = """
import openai

def ask_openai(user_prompt: str):
    return openai.ChatCompletion.create(prompt=user_prompt)

def main():
    prompt_var = "Tell me a joke!"
    ask_openai(prompt_var)
"""
    src = tmp_path / "test.py"
    src.write_text(code)

    runner = CliRunner()
    result = runner.invoke(app, ["ai-inventory", str(src)])

    assert result.exit_code == 0
    inventory_data = json.loads(result.stdout)
    components = inventory_data["inventory_by_file"][0]["components"]

    # Test call_chain
    ask_openai_func = next(c for c in components if c["name"].endswith(".ask_openai"))
    assert ask_openai_func is not None, "ask_openai component not found"

    # Test "calls" relationship
    main_func = next(c for c in components if c["name"].endswith(".main"))
    main_calls = [
        r["target_name"] for r in main_func["relationships"] if r["type"] == "calls"
    ]
    assert ask_openai_func["name"] in main_calls

    # Test "uses" relationship
    ask_openai_uses = [
        r["target_name"]
        for r in ask_openai_func["relationships"]
        if r["type"] == "uses"
    ]
    assert (
        "user_prompt" in ask_openai_uses
    )  # Note: This will require further refinement of the logic
