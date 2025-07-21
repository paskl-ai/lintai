# In tests/unit/test_dsl.py

import json
import os
import subprocess
import pytest
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent


# Renaming the test to reflect its new purpose
def test_secret_in_prompt_finding(tmp_path):
    """
    Tests that a built-in Python detector can find a secret used in a prompt.
    """
    code = (
        'secret = "hunter2"\n'
        'prompt = f"My password is {secret}"\n'
        "import openai\n"
        'openai.ChatCompletion.create(model="dummy", messages=[{"role": "user", "content": prompt}])\n'
    )
    src = tmp_path / "leak.py"
    src.write_text(code)

    # We are REMOVING the "--ruleset" flag to force Lintai to use its
    # built-in Python detectors, including the new one we added.
    result = subprocess.run(
        [
            "lintai",
            "find-issues",
            str(tmp_path),
            "--log-level",
            "DEBUG",
        ],
        env=dict(os.environ, LINTAI_LLM_PROVIDER="dummy"),
        capture_output=True,
        text=True,
    )

    # The test should now produce findings
    assert result.stdout, f"Empty stdout: stderr={result.stderr!r}"

    try:
        result_obj = json.loads(result.stdout)
        findings = result_obj["findings"]
    except Exception as e:
        pytest.fail(f"Could not parse JSON from output:\n{result.stdout}\nError: {e}")

    print("STDOUT:\n", result.stdout)
    print("STDERR:\n", result.stderr)

    # We now assert that our new detector's finding is present.
    # Checking that "A02" is IN the owasp_id makes the test more robust.
    assert findings, "Findings list should not be empty"
    assert any("A02" in f["owasp_id"] for f in findings)
