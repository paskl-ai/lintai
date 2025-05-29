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
    target = env_path or Path(".env")
    if not target.exists():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(dotenv_path=target, override=False)
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
    units: list[PythonASTUnit] = []
    for fp in iter_python_files(path, ignore_spec):
        try:
            units.append(PythonASTUnit(fp, fp.read_text(encoding="utf-8")))
        except UnicodeDecodeError:
            logger.warning("Skipping non-utf8 file %s", fp)
    return units


# ------------------------------------------------------------------ Typer callback
def init_common(
    ctx: Context,
    path: Path,
    env_file: Path | None,
    log_level: str,
    ai_call_depth: int,
    ruleset: Path | None,
):
    """Shared bootstrap executed before *every* command."""
    # logging
    logging.getLogger().setLevel(getattr(logging, log_level.upper(), logging.INFO))

    if not path.exists():
        ctx.fail(f"Path '{path}' does not exist.")

    maybe_load_env(env_file)

    ignore_spec = _load_ignore(path)

    # AST + AI engine
    units = build_ast_units(path, ignore_spec)
    _init_ai_engine(units, depth=ai_call_depth)

    load_plugins()
    if ruleset:
        load_rules(ruleset)

    # make them available to the command via Typer's context obj
    ctx.obj = {
        "units": units,
        "ignore_spec": ignore_spec,
    }
