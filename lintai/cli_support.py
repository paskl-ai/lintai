# lintai/cli_support.py
from __future__ import annotations
import logging, os
from pathlib import Path
from typing import Iterable, List

import pathspec
from typer import Context

from lintai.core.loader import load_plugins
from lintai.dsl.loader import load_rules
from lintai.engine.python_ast_unit import PythonASTUnit
from lintai.engine import initialise as _init_ai_engine
from lintai.llm import budget

_DEFAULT_FMT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
logging.basicConfig(level=logging.INFO, format=_DEFAULT_FMT)
logger = logging.getLogger("lintai.cli")

_NOISY_HTTP_LOGGERS = (
    "httpcore",
    "httpx",
    "openai._base_client",
    "urllib3.connectionpool",
)
for n in _NOISY_HTTP_LOGGERS:
    logging.getLogger(n).setLevel(logging.WARNING)


# ------------------------------------------------------------------ utils
def _load_ignore(search_root: Path) -> pathspec.PathSpec:
    candidates = []

    # if scanning a file, use its directory
    if search_root.is_file():
        candidates.append(search_root.parent)
    else:
        candidates.append(search_root)

    # also try the current working directory
    candidates.append(Path.cwd())

    # look for .lintaiignore or .gitignore in the candidates
    for name in (".lintaiignore", ".gitignore"):
        for base in candidates:
            p = base / name
            if p.is_file():
                logger.info("Loading ignore patterns from %s", p)
                return pathspec.PathSpec.from_lines(
                    "gitwildmatch", p.read_text().splitlines()
                )

    logger.info(
        "No .lintaiignore or .gitignore found in %s or CWD. Will not ignore any files.",
        candidates,
    )
    return pathspec.PathSpec.from_lines("gitwildmatch", [])


def iter_python_files(root: Path, ignore_spec: pathspec.PathSpec) -> Iterable[Path]:
    if root.is_file():
        if root.suffix == ".py":
            yield root
        return
    for p in root.rglob("*.py"):
        if ignore_spec.match_file(p.relative_to(root).as_posix()):
            continue
        yield p


def maybe_load_env(env_path: Path | None) -> None:
    """best-effort .env reader (identical logic used by scan / inventory)."""
    if env_path is not None:
        # Explicit env file specified
        target = env_path
        # Override existing env vars when explicit file is specified
        should_override = True
    else:
        # Default to .env in current directory
        target = Path(".env")
        # Don't override when loading default .env
        should_override = False

    if not target.exists():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(dotenv_path=target, override=should_override)
        logger.info("Loaded provider settings from %s (python-dotenv)", target)
        # reload budget manager to pick up new limits
        budget.manager.reload()
        return
    except ModuleNotFoundError:
        pass  # fallback
    for line in target.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = map(str.strip, line.split("=", 1))
        os.environ[k] = v
    logger.info("Loaded provider settings from %s (fallback parser)", target)

    # reload budget manager to pick up new limits
    budget.manager.reload()
    return


def build_ast_units(path: Path, ignore_spec: pathspec.PathSpec) -> List[PythonASTUnit]:
    """
    Finds all python files, creates a shared project_root for them, and
    builds a PythonASTUnit for each one.
    """
    units: list[PythonASTUnit] = []

    # --- NEW: Collect all file paths into a list first ---
    python_files = list(iter_python_files(path, ignore_spec))

    if not python_files:
        return []

    # --- NEW: Determine a common root path for clean module names ---
    # This ensures that module names are relative and clean, not long absolute paths.
    if len(python_files) == 1:
        project_root = python_files[0].parent
    else:
        project_root = Path(os.path.commonpath([str(p) for p in python_files]))

    # --- MODIFIED: Loop through the collected files ---
    for fp in python_files:
        try:
            # Pass the calculated project_root to the constructor
            units.append(
                PythonASTUnit(
                    fp, fp.read_text(encoding="utf-8"), project_root=project_root
                )
            )
        except UnicodeDecodeError:
            logger.warning("Skipping non-utf8 file %s", fp)
        except Exception as e:
            logger.error("Failed to parse %s: %s", fp, e)

    return units


# ------------------------------------------------------------------ Typer callback
def init_common(
    ctx: Context,
    paths: List[Path],
    env_file: Path | None,
    log_level: str,
    ai_call_depth: int,
    ruleset: Path | None,
):
    """Shared bootstrap executed before *every* command."""
    # logging
    log_level_obj = getattr(logging, log_level.upper(), logging.INFO)
    logging.getLogger().setLevel(log_level_obj)

    # Debug: dump environment variables when at debug level
    if log_level_obj <= logging.DEBUG:
        logger.debug("=== CLI Environment Debug ===")
        logger.debug(f"Log level: {log_level}")
        logger.debug(f"Environment file: {env_file}")
        logger.debug("LLM Environment Variables:")
        for key, value in os.environ.items():
            if (
                key.startswith("LINTAI_")
                or key.startswith("OPENAI_")
                or key.startswith("ANTHROPIC_")
            ):
                logger.debug(f"  {key}={value}")
        logger.debug("=== End Environment Debug ===")

    # Validate all paths exist
    for path in paths:
        if not path.exists():
            ctx.fail(f"Path '{path}' does not exist.")

    maybe_load_env(env_file)

    # Build ignore spec based on the first path (or current directory if no paths)
    # TODO: Consider improving this to handle ignore files from multiple directories
    base_path = paths[0] if paths else Path.cwd()
    ignore_spec = _load_ignore(base_path)

    # AST + AI engine - collect units from all paths
    units = []
    for path in paths:
        units.extend(build_ast_units(path, ignore_spec))
    _init_ai_engine(units, depth=ai_call_depth)

    load_plugins()
    if ruleset:
        load_rules(ruleset)

    # make them available to the command via Typer's context obj
    ctx.obj = {
        "units": units,
        "ignore_spec": ignore_spec,
    }
