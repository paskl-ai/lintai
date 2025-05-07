from typer.testing import CliRunner
from lintai.cli import app

def test_cli_runs():
    runner = CliRunner()
    result = runner.invoke(app, ["scan"])
    assert result.exit_code == 0
