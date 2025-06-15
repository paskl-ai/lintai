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

from lintai.engine.analysis import ProjectAnalyzer
from lintai.models.inventory import FileInventory 


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
    report.write_scan_report(findings, output)

    if output:
        typer.echo(f"\n✅ Report written to {output}")
    raise typer.Exit(1 if any(f.severity == "blocker" for f in findings) else 0)


def create_graph_payload(inventories: List[FileInventory]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Converts the inventories into a Cytoscape.js-compatible graph format.
    """
    nodes = []
    edges = []
    seen_nodes = set()

    for inventory in inventories:
        for comp in inventory.components:
            node_id = f"{comp.location}" # Use location for a unique ID
            if node_id not in seen_nodes:
                nodes.append({
                    "data": {
                        "id": node_id,
                        "label": comp.name,
                        "type": comp.component_type,
                        "file": inventory.file_path
                    }
                })
                seen_nodes.add(node_id)
            
            # Add edges from the relationships
            if "uses" in comp.relationships:
                for target_name in comp.relationships["uses"]:
                    # This requires a lookup to find the target's location/ID
                    # This logic can be enhanced later for cross-file resolution
                    edges.append({
                        "data": {
                            "source": node_id,
                            "target": target_name, # Simplified for now
                            "label": "uses"
                        }
                    })
    return {"nodes": nodes, "edges": edges}


# ──────────────────────────────────────────────────────────────────────────────
# ai-inventory  ----------------------------------------------------------------
# ──────────────────────────────────────────────────────────────────────────────
@app.command("ai-inventory", help="Emit a unified JSON inventory of all AI components.")
def ai_inventory_cmd(
    ctx: Context,
    path: Path = Argument(..., exists=True, readable=True, help="File or directory to analyse"),
    ruleset: Path = Option(None, "--ruleset", "-r", help="Custom rule file/folder"),
    env_file: Path = Option(None, "--env-file", "-e", help="Optional .env"),
    log_level: str = Option("INFO", "--log-level", "-l", help="Logging level"),
    ai_call_depth: int = Option(2, "--ai-call-depth", "-d", help="How many caller layers to trace for relationships"),
    output: Path = Option(None, "--output", "-o", help="Write JSON output to file (default: stdout)"),
    graph: bool = Option(False, "--graph", "-g", help="Include full call-graph payload for visualization.")
):
    """
    Analyzes the codebase to produce a unified inventory of AI components,
    optionally including a full graph representation.
    """
    # The bootstrap function remains the same, initializing the project units
    _bootstrap(
        ctx,
        path=path,
        env_file=env_file,
        log_level=log_level,
        ai_call_depth=ai_call_depth,
        ruleset=ruleset,
    )

    units = ctx.obj["units"]
    
    # 1. Run our new, unified analysis engine
    analyzer = ProjectAnalyzer(units, call_depth=ai_call_depth).analyze()
    
    # 2. Get the results from the .inventories attribute
    inventory_list = [inv.model_dump() for inv in analyzer.inventories.values()]
    
    # 3. Prepare the final output object
    final_output = {
        "inventory_by_file": inventory_list
    }

    # 4. Conditionally add the graph payload if the --graph flag is present
    if graph:
        graph_data = create_graph_payload(list(analyzer.inventories.values()))
        final_output["graph"] = graph_data
    
    # 5. Write the final JSON to the specified output or to the console
    if output:
        output.write_text(json.dumps(final_output, indent=2))
        typer.echo(f"\n✅ Inventory written to {output}")
    else:
        typer.echo(json.dumps(final_output, indent=2))


# ──────────────────────────────────────────────────────────────────────────────
# ui  ---------------------------------------------------------------------------
# ──────────────────────────────────────────────────────────────────────────────
@app.command("ui", help="Launch browser UI")
def ui_cmd(
    port: int = Option(8501, "--port", "-p", help="Port to listen on"),
    reload: bool = Option(False, "--reload", help="Auto-reload on code changes"),
):
    """
    Start FastAPI + React UI.
    """
    uvicorn.run(
        "lintai.ui.server:app",
        host="127.0.0.1",
        port=port,
        reload=reload,
    )


# ──────────────────────────────────────────────────────────────────────────────
def main() -> None:  # entry-point in setup.cfg / pyproject.toml
    app()


if __name__ == "__main__":
    main()
