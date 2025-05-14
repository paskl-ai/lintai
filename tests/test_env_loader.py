import os, json, subprocess, textwrap, pathlib


def test_env_file_loading(tmp_path):
    env = tmp_path / ".env"
    env.write_text("LINTAI_LLM_PROVIDER=dummy\nEXTRA=42\n")

    src = tmp_path / "t.py"
    src.write_text("print('hi')")

    res = subprocess.run(
        ["lintai", "scan", str(src), "-e", str(env)],
        capture_output=True,
        text=True,
    )

    # CLI should exit 0 because no blocker findings
    assert res.returncode == 0, res.stderr
    # Optional: sanity‑check that lintai read the env file
    assert "Loaded provider settings from" in res.stderr
