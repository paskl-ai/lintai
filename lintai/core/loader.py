"""
Plugin loader for lintai.

External packages can expose detectors by declaring in their
pyproject.toml / setup.cfg:

[project.entry-points."lintai.detectors"]
my_rules = "my_pkg.my_module"
"""

from importlib.metadata import entry_points
import logging

logger = logging.getLogger(__name__)

# group name is a constant; keep identical across ecosystem
_EP_GROUP = "lintai.detectors"

def load_plugins(group: str = _EP_GROUP):
    """
    Import every entry‑point in *lintai.detectors*.
    External modules can then use @lintai.detectors.register(...)
    exactly like built‑ins.
    """
    for ep in entry_points(group=group):
        try:
            ep.load()                    # import side‑effect
            logger.debug(f"[lintai] plugin loaded: {ep.value}")
        except Exception as exc:
            logger.error(f"[lintai] failed to load plugin {ep.name}: {exc}")
