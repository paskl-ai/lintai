from typer.testing import CliRunner
from lintai.cli import app


def test_cli_runs(tmp_path):
    dummy = tmp_path / "foo.py"
    dummy.write_text("print('hello')")
    runner = CliRunner()
    result = runner.invoke(
        app,
        ["scan", str(tmp_path)],
        env={"LINTAI_LLM_PROVIDER": "dummy"}
    )
    assert result.exit_code == 0
