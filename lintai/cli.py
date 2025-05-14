"""
CLI entry‑point for Lintai.
* Logs -> stderr
* Findings JSON -> stdout
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Iterable, List
import pathspec
import typer

from lintai.core.loader import load_plugins
from lintai.detectors import run_all
from lintai.dsl.loader import load_rules
from lintai.engine.python_ast_unit import PythonASTUnit

# --------------------------------------------------------------------------- #
# CLI scaffold
# --------------------------------------------------------------------------- #
app = typer.Typer(help="Lintai – shift‑left GenAI security scanner")

_DEFAULT_FMT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
logging.basicConfig(level=logging.INFO, format=_DEFAULT_FMT)
logger = logging.getLogger("lintai.cli")


# --------------------------------------------------------------------------- #
# Helper functions
# --------------------------------------------------------------------------- #
# Load ignore patterns from .lintaiignore if it exists; otherwise, use an empty list
if Path(".lintaiignore").exists():
    _IGNORE = pathspec.PathSpec.from_lines(
        "gitwildmatch", Path(".lintaiignore").read_text().splitlines()
    )
else:
    _IGNORE = pathspec.PathSpec.from_lines("gitwildmatch", [])


def _iter_python_files(root: Path) -> Iterable[Path]:
    for path in root if root.is_file() else root.rglob("*.py"):
        if _IGNORE.match_file(path.relative_to(root).as_posix()):
            continue
        yield path


def _maybe_load_env(env_path: Path | None) -> None:
    """
    Load environment variables from a .env file once, without overriding values
    that are already present in os.environ.
    Priority order:
      1. Existing env vars
      2. --env-file  <path>
      3.   .env      in current working directory
    """
    target = env_path or Path(".env")
    if not target.exists():
        return

    try:  # best‑effort: use python‑dotenv if available
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(dotenv_path=target, override=False)
        logger.info("Loaded provider settings from %s (python‑dotenv)", target)
        return
    except ModuleNotFoundError:
        logger.debug("python‑dotenv not installed; using fallback .env parser")

    for line in target.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = map(str.strip, line.split("=", 1))
        os.environ.setdefault(key, val)

    logger.info("Loaded provider settings from %s (fallback parser)", target)


# --------------------------------------------------------------------------- #
# core scanning routine – usable by future web UI                              #
# --------------------------------------------------------------------------- #
def run_scan(
    path: Path,
    *,
    ruleset: Path | None = None,
) -> List[dict]:
    """Return a list of Finding‑dicts for the given path."""
    load_plugins()

    if ruleset:
        logger.info("Loading custom ruleset from %s", ruleset)
        load_rules(ruleset)

    findings = []
    for file_path in _iter_python_files(path):
        try:
            text = file_path.read_text(encoding="utf‑8")
        except UnicodeDecodeError:
            logger.warning("Skipping non‑utf8 file %s", file_path)
            continue

        unit = PythonASTUnit(file_path, text)
        findings.extend(run_all(unit))

    return [f.to_dict() for f in findings]


# --------------------------------------------------------------------------- #
# CLI command: lintai scan …
# --------------------------------------------------------------------------- #
@app.command("scan")
def scan_command(
    path: Path = typer.Argument(..., help="File or directory to scan"),
    ruleset: Path
    | None = typer.Option(
        None, "--ruleset", "-r", help="Path to YAML/JSON rule file or folder"
    ),
    env_file: Path
    | None = typer.Option(
        None, "--env-file", "-e", help="Optional .env with provider keys"
    ),
    log_level: str = typer.Option(
        "INFO", "--log-level", "-l", help="python logging level (INFO, DEBUG, …)"
    ),
    version: bool = typer.Option(False, "--version", help="Show version and exit"),
):
    """Static‑analyse the target path and emit findings JSON."""
    if version:
        from lintai import __version__

        typer.echo(f"Lintai {__version__}")
        raise typer.Exit()

    # ---------- logging -------------------------------------------------- #
    try:
        logging.getLogger().setLevel(getattr(logging, log_level.upper()))
    except AttributeError:
        typer.echo(
            f"Unknown log‑level '{log_level}'. Expected DEBUG/INFO/WARNING/ERROR.",
            err=True,
        )
        raise typer.Exit(2)

    if not path.exists():
        typer.echo(f"Path '{path}' does not exist.", err=True)
        raise typer.Exit(2)

    # ---------- .env loader ---------------------------------------------- #
    _maybe_load_env(env_file)

    logger.info("Scanning started.")
    findings_dicts = run_scan(path, ruleset=ruleset)

    # ---------- output ---------------------------------------------------- #
    typer.echo(json.dumps(findings_dicts, indent=2))
    exit_code = 1 if any(f["severity"] == "blocker" for f in findings_dicts) else 0
    raise typer.Exit(exit_code)


# --------------------------------------------------------------------------- #
# placeholder commands (future UI endpoints)                                  #
# --------------------------------------------------------------------------- #
@app.command("list-ai-use")
def list_ai_use():
    """List AI usage across the codebase (todo)."""
    logger.warning("list-ai-use not implemented yet")


@app.command("config")
def config_command():
    """Config utility (todo)."""
    logger.warning("config command not implemented yet")


# --------------------------------------------------------------------------- #
# entry‑point
# --------------------------------------------------------------------------- #
def main():
    app()


if __name__ == "__main__":
    main()
