import json
from pathlib import Path
import typer
from lintai.core.loader import load_plugins
from lintai.detectors import run_all
from lintai.detectors.base import SourceUnit

# Top-level app
app = typer.Typer(help="Lintai – shift-left LLM security scanner")

class DummyUnit(SourceUnit):
    def joined_fstrings(self): return []
    def is_user_tainted(self, node): return False
    def has_call(self, name, node): return False

# Define the scan subcommand
@app.command("scan")
def scan_command(
    path: Path = typer.Argument(..., help="Path to scan."),  # Make path required
    ruleset: str = typer.Option(None, "-r", "--ruleset", help="Specify custom ruleset to apply."),
    verbose: bool = typer.Option(False, "-v", "--verbose", help="Enable verbose mode."),
    version: bool = typer.Option(False, "--version", help="Show version and exit.")
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
    
    load_plugins()
    unit = DummyUnit(path)
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