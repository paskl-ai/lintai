import json
import logging
from pathlib import Path
import typer
from lintai.core.loader import load_plugins
from lintai.detectors import run_all
from lintai.engine.python_ast_unit import PythonASTUnit

# Top-level app
app = typer.Typer(help="Lintai – shift-left LLM security scanner")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()],
)

logger = logging.getLogger(__name__)


def _iter_python_files(root: Path):
    if root.is_file() and root.suffix == ".py":
        yield root
    for p in root.rglob("*.py"):
        yield p


def set_log_level(verbose: bool):
    logging.getLogger().setLevel(logging.DEBUG if verbose else logging.INFO)


# Define the scan subcommand
@app.command("scan")
def scan_command(
    path: Path = typer.Argument(..., help="Path to scan."),  # Make path required
    ruleset: str = typer.Option(
        None, "-r", "--ruleset", help="Specify custom ruleset to apply."
    ),
    verbose: bool = typer.Option(False, "-v", "--verbose", help="Enable verbose mode."),
    version: bool = typer.Option(False, "--version", help="Show version and exit."),
):
    """
    Scan the specified directory or file for LLM-specific security issues.
    """
    if version:
        from lintai import __version__

        typer.echo(f"Lintai {__version__}")
        raise typer.Exit()

    if verbose:
        typer.echo(f"Scanning {path} with ruleset: {ruleset or 'default'}")

    set_log_level(verbose)

    load_plugins()
    if not path.exists():
        typer.echo(f"Path {path} does not exist.")
        raise typer.Exit(1)

    findings = []
    logger.info("Scanning started.")

    for file_path in _iter_python_files(path):
        text = file_path.read_text(encoding="utf-8")
        unit = PythonASTUnit(file_path, text)
        findings.extend(run_all(unit))
        findings = run_all(unit)

    if ruleset:
        typer.echo(f"Using custom ruleset: {ruleset}")

    typer.echo(json.dumps([f.to_dict() for f in findings], indent=2))
    raise typer.Exit(1 if any(f.severity == "blocker" for f in findings) else 0)


# Placeholder for future commands
@app.command("list-ai-use")
def list_ai_use():
    """
    List AI usage across the codebase.
    """
    typer.echo("Listing AI usage - functionality to be implemented")


@app.command("config")
def config_command():
    """
    Configure Lintai settings.
    """
    typer.echo("Configuration utility - functionality to be implemented")


def main():
    """
    Main entry point for the CLI.
    """
    app()


if __name__ == "__main__":
    main()
