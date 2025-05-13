"""
CLI entry‑point for Lintai.
Logs go to stderr; JSON findings go to stdout.
"""

from __future__ import annotations
import json, logging
from pathlib import Path
import typer
from lintai.core.loader import load_plugins
from lintai.detectors import run_all
from lintai.engine.python_ast_unit import PythonASTUnit
from lintai.dsl.loader import load_rules

app = typer.Typer(help="Lintai – shift‑left LLM security scanner")

# -----------------------------------------------------------------------------
# logging config – everything goes to stderr
# -----------------------------------------------------------------------------
_DEFAULT_FMT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
logging.basicConfig(level=logging.INFO, format=_DEFAULT_FMT)

logger = logging.getLogger("lintai.cli")


# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------
def _iter_python_files(root: Path):
    if root.is_file() and root.suffix == ".py":
        yield root
    else:
        yield from root.rglob("*.py")


# -----------------------------------------------------------------------------
# scan command
# -----------------------------------------------------------------------------
@app.command("scan")
def scan_command(
    path: Path = typer.Argument(..., help="File or directory to scan"),
    ruleset: Path | None = typer.Option(None, "--ruleset", "-r", help="Path to YAML/JSON rule file or folder"),
    log_level: str = typer.Option("INFO", "--log-level", "-l", help="python logging level (INFO, DEBUG, …)"),
    version: bool = typer.Option(False, "--version", help="Show version and exit"),
):
    if version:
        from lintai import __version__
        typer.echo(f"Lintai {__version__}")
        raise typer.Exit()

    # ------------------------------------------------------------------ #
    # validate inputs & set logging
    # ------------------------------------------------------------------ #
    try:
        logging.getLogger().setLevel(getattr(logging, log_level.upper()))
    except AttributeError:
        typer.echo(f"Unknown log‑level '{log_level}'. Expected DEBUG/INFO/WARNING/ERROR.", err=True)
        raise typer.Exit(2)

    if not path.exists():
        typer.echo(f"Path '{path}' does not exist.", err=True)
        raise typer.Exit(2)

    load_plugins()

    if ruleset:
        logger.info("Loading custom ruleset from %s", ruleset)
        load_rules(ruleset)

    logger.info("Scanning started.")

    # ------------------------------------------------------------------ #
    # run detectors
    # ------------------------------------------------------------------ #
    all_findings: list = []

    for file_path in _iter_python_files(path):
        try:
            text = file_path.read_text(encoding="utf‑8")
        except UnicodeDecodeError:
            logger.warning("Skipping non‑utf8 file %s", file_path)
            continue

        unit = PythonASTUnit(file_path, text)
        all_findings.extend(run_all(unit))

    # ------------------------------------------------------------------ #
    # emit findings JSON to stdout only
    # ------------------------------------------------------------------ #
    typer.echo(json.dumps([f.to_dict() for f in all_findings], indent=2))

    exit_code = 1 if any(f.severity == "blocker" for f in all_findings) else 0
    raise typer.Exit(exit_code)


# -----------------------------------------------------------------------------
# placeholder commands
# -----------------------------------------------------------------------------
@app.command("list-ai-use")
def list_ai_use():
    """List AI usage across the codebase (todo)."""
    logger.warning("list-ai-use not implemented yet")


@app.command("config")
def config_command():
    """Config utility (todo)."""
    logger.warning("config command not implemented yet")


def main():
    app()


if __name__ == "__main__":
    main()
