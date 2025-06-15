from typer.testing import CliRunner
from lintai.cli import app
import json


def test_cli_runs(tmp_path):
    dummy = tmp_path / "foo.py"
    dummy.write_text("print('hello')")
    runner = CliRunner()
    result = runner.invoke(
        app, ["scan", str(tmp_path)], env={"LINTAI_LLM_PROVIDER": "dummy"}
    )
    assert result.exit_code == 0

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
    main_calls = [r["target_name"] for r in main_func["relationships"] if r["type"] == "calls"]
    assert ask_openai_func["name"] in main_calls

    # Test "uses" relationship
    ask_openai_uses = [r["target_name"] for r in ask_openai_func["relationships"] if r["type"] == "uses"]
    assert "user_prompt" in ask_openai_uses # Note: This will require further refinement of the logic