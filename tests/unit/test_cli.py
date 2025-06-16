import os
from pathlib import Path
from lintai.cli import app
from typer.testing import CliRunner


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
