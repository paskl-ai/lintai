__all__ = []

try:
    from importlib.metadata import version

    __version__ = version("lintai")
except Exception:
    # Fallback if package not installed (development mode)
    __version__ = "dev"
