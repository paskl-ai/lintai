from importlib.metadata import entry_points

def load_plugins(group: str = "lintai.plugins"):
    for ep in entry_points(group=group):
        ep.load()
