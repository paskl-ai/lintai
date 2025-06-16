# lintai/cli.py
from __future__ import annotations

import ast
import json
from collections import defaultdict
from pathlib import Path
from typing import List

import typer
from typer import Argument, Context, Option

from lintai.cli_support import init_common
from lintai.detectors import run_all
from lintai.core import report
import lintai.engine as _engine
import uvicorn

from lintai.engine.inventory_builder import build_inventory
from lintai.engine.inventory_builder import (
    classify_sink,
    detect_frameworks,
    extract_ast_components,
)


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
    output: Path = Option(
        None, "--output", "-o", help="Write JSON output to file (default: stdout)"
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
    findings = [f for u in units for f in run_all(u)]

    # Save full report with LLM usage
    report_data = report.make_scan_report(findings, str(path))
    report.write_report_obj(report_data, output)

    if output:
        typer.echo(f"\n✅ Report written to {output}")
    raise typer.Exit(1 if any(f.severity == "blocker" for f in findings) else 0)


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
    output: Path = Option(
        None, "--output", "-o", help="Write JSON output to file (default: stdout)"
    ),
    graph: bool = Option(
        False, "--graph", "-g", help="Include full call-graph payload"
    ),
    group_by: str = Option(
        None, "--group-by", help="Group AI inventory by attribute (e.g. 'file')"
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
    inventory = [] if not graph else None
    graph_records = [] if graph else None
    components_by_file = defaultdict(list)

    for sink in ana.ai_calls:
        record = {
            "sink": sink.fq_name,
            "at": f"{sink.file}:{sink.lineno}",
            "callers": [],
        }

        if not graph:
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

            file_path = str(sink.file)
            components_by_file[file_path].append(
                {
                    "type": classify_sink(sink.fq_name),
                    "sink": sink.fq_name,
                    "at": f"{sink.file}:{sink.lineno}",
                }
            )

        else:
            elements = ana.graph_for_sink(sink, depth)
            graph_records.append(
                {"sink": sink.fq_name, "at": record["at"], "elements": elements}
            )

    component_reports = []
    for file_path, components in components_by_file.items():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read())
            frameworks = detect_frameworks(tree)
            additional = extract_ast_components(tree, file_path)
            components.extend(additional)
        except Exception as e:
            typer.echo(f"❌ Error parsing AST for {file_path}: {e}")
            frameworks = []

        component_reports.append(
            {
                "file": file_path,
                "frameworks": frameworks,
                "components": components,
            }
        )

    if graph:
        doc = report.make_graph_inventory_report(graph_records, str(path))
        report.write_report_obj(doc, output)
    else:
        if group_by == "file":
            grouped = defaultdict(
                lambda: {"ai_calls": [], "components": [], "frameworks": []}
            )
            for item in inventory:
                file = item["at"].split(":")[0]
                grouped[file]["ai_calls"].append(item)
            for comp in component_reports:
                grouped[comp["file"]]["components"].extend(comp["components"])
                grouped[comp["file"]]["frameworks"].extend(comp["frameworks"])

            output_data = [{"file": k, **v} for k, v in grouped.items()]
            doc = report.make_simple_inventory_report(output_data, str(path))
        else:
            output_data = {
                "ai_call_inventory": inventory,
                "component_inventory": component_reports,
            }
            doc = report.make_simple_inventory_report(output_data, str(path))
        report.write_report_obj(doc, output)

    if output:
        typer.echo(f"\n✅ Inventory written to {output}")


# ──────────────────────────────────────────────────────────────────────────────
# ui  ---------------------------------------------------------------------------
# ──────────────────────────────────────────────────────────────────────────────
@app.command("ui", help="Launch browser UI")
def ui_cmd(
    ctx: Context,
    port: int = Option(8501, "--port", "-p", help="Port to listen on"),
    reload: bool = Option(False, "--reload", help="Auto-reload on code changes"),
    log_level: str = Option("INFO", "--log-level", "-l", help="Logging level"),
):
    """
    Start FastAPI + React UI.
    """
    # Initialize logging with the specified level
    init_common(
        ctx,
        path=Path.cwd(),  # dummy path for UI
        env_file=None,
        log_level=log_level,
        ai_call_depth=1,  # dummy depth for UI
        ruleset=None,
    )

    # Set the server log level for CLI subprocesses
    from lintai.ui.server import set_server_log_level

    set_server_log_level(log_level)

    uvicorn.run(
        "lintai.ui.server:app",
        host="127.0.0.1",
        port=port,
        reload=reload,
        log_level=log_level.lower(),
    )


# ──────────────────────────────────────────────────────────────────────────────
def main() -> None:  # entry-point in setup.cfg / pyproject.toml
    app()


if __name__ == "__main__":
    main()
