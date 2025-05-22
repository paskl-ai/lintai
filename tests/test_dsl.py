import subprocess, json, pathlib, os
import pytest

ROOT = pathlib.Path(__file__).parents[1]


def test_dsl_rule_hits(tmp_path):
    code = (
        'secret = "hunter2"\n'
        'prompt = f"My password is {secret}"\n'
        "import openai\n"
        'openai.ChatCompletion.create(model="dummy", messages=[{"role": "user", "content": prompt}])\n'
    )
    src = tmp_path / "leak.py"
    src.write_text(code)

    result = subprocess.run(
        [
            "lintai",
            "scan",
            str(tmp_path),
            "--ruleset",
            str(ROOT / "lintai/dsl/rules"),
            "--log-level",
            "DEBUG",
        ],
        env=dict(os.environ, LINTAI_LLM_PROVIDER="dummy"),
        capture_output=True,
        text=True,
    )

    lines = result.stdout.strip().splitlines()
    assert lines, f"Empty output: stderr={result.stderr!r}"

    try:
        findings = json.loads(result.stdout)
    except Exception as e:
        pytest.fail(f"Could not parse JSON from output:\n{result.stdout}\nError: {e}")

    print("STDOUT:\n", result.stdout)
    print("STDERR:\n", result.stderr)

    assert any(f["owasp_id"] == "A02" for f in findings)
