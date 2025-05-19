# lintai/cli.py
from __future__ import annotations

import json
from pathlib import Path
from typing import List

import typer
from typer import Argument, Context, Option

from lintai.cli_support import init_common
from lintai.detectors import run_all
import lintai.engine as _engine

app = typer.Typer(
    help="Lintai – shift-left GenAI security scanner",
    add_completion=False,  # ← hides show/install-completion flags
)


# ──────────────────────────────────────────────────────────────────────────────
# SHARED BOOTSTRAP (runs once per CLI call) ───────────────────────────────────
# ──────────────────────────────────────────────────────────────────────────────
def _bootstrap(
    ctx: Context,
    *,
    path: Path,
    env_file: Path | None,
    log_level: str,
    ai_call_depth: int,
    ruleset: Path | None,
) -> None:
    """Parse Python files + initialise AI-analysis engine (once)."""
    if ctx.obj is None:
        ctx.obj = {}
    if "units" in ctx.obj:  # another sub-command already did this
        return

    init_common(
        ctx,
        path=path,
        env_file=env_file,
        log_level=log_level,
        ai_call_depth=ai_call_depth,
        ruleset=ruleset,
    )


# ──────────────────────────────────────────────────────────────────────────────
# TOP-LEVEL OPTIONS – only --version here -------------------------------------
# ──────────────────────────────────────────────────────────────────────────────
@app.callback(invoke_without_command=True)
def top_callback(
    ctx: Context,
    version: bool = Option(False, "--version", help="Show version and exit"),
):
    if version:
        from lintai import __version__

        typer.echo(f"Lintai {__version__}")
        raise typer.Exit()


# ──────────────────────────────────────────────────────────────────────────────
# scan  -----------------------------------------------------------------------
# ──────────────────────────────────────────────────────────────────────────────
@app.command("scan", help="Run all detectors and emit findings JSON.")
def scan_cmd(
    ctx: Context,
    path: Path = Argument(
        ..., exists=True, readable=True, help="File or directory to analyse"
    ),
    ruleset: Path | None = Option(
        None, "--ruleset", "-r", help="Custom rule file/folder"
    ),
    env_file: Path | None = Option(None, "--env-file", "-e", help="Optional .env"),
    log_level: str = Option("INFO", "--log-level", "-l", help="Logging level"),
    ai_call_depth: int = Option(
        2,
        "--ai-call-depth",
        "-d",
        help="How many caller layers to mark as AI-related (default 2)",
    ),
):
    _bootstrap(
        ctx,
        path=path,
        env_file=env_file,
        log_level=log_level,
        ai_call_depth=ai_call_depth,
        ruleset=ruleset,
    )

    units = ctx.obj["units"]
    findings = [f.to_dict() for u in units for f in run_all(u)]

    typer.echo(json.dumps(findings, indent=2))
    raise typer.Exit(1 if any(f["severity"] == "blocker" for f in findings) else 0)


# ──────────────────────────────────────────────────────────────────────────────
# ai-inventory  ----------------------------------------------------------------
# ──────────────────────────────────────────────────────────────────────────────
@app.command(
    "ai-inventory",
    help="Emit a JSON list with every *direct* AI sink and its wrappers/"
    "callers up to the requested depth.",
)
def ai_inventory_cmd(
    ctx: Context,
    path: Path = Argument(
        ..., exists=True, readable=True, help="File or directory to analyse"
    ),
    ruleset: Path | None = Option(
        None, "--ruleset", "-r", help="Custom rule file/folder"
    ),
    env_file: Path | None = Option(None, "--env-file", "-e", help="Optional .env"),
    log_level: str = Option("INFO", "--log-level", "-l", help="Logging level"),
    ai_call_depth: int = Option(
        2,
        "--ai-call-depth",
        "-d",
        help="How many caller layers to mark as AI-related (default 2)",
    ),
):
    _bootstrap(
        ctx,
        path=path,
        env_file=env_file,
        log_level=log_level,
        ai_call_depth=ai_call_depth,
        ruleset=ruleset,
    )

    ana = _engine.ai_analyzer
    if ana is None:
        ctx.fail("AI engine not initialised – internal error")

    depth = ana.call_depth
    inventory: List[dict] = []

    for sink in ana.ai_calls:
        record = {
            "sink": sink.fq_name,
            "at": f"{sink.file}:{sink.lineno}",
            "callers": [],
        }

        # walk *upwards* through the call-graph (breadth-first)
        frontier = {
            fn for fn, callees in ana.call_graph.items() if sink.fq_name in callees
        }
        seen = set()
        lvl = 0
        while frontier and lvl < depth:
            record["callers"].extend(sorted(frontier))
            seen.update(frontier)
            frontier = {
                parent
                for parent, callees in ana.call_graph.items()
                if callees & frontier and parent not in seen
            }
            lvl += 1

        inventory.append(record)

    typer.echo(json.dumps(inventory, indent=2))


# ──────────────────────────────────────────────────────────────────────────────
def main() -> None:  # entry-point in setup.cfg / pyproject.toml
    app()


if __name__ == "__main__":
    main()
