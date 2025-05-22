import servicenow, os


def call_nowassist(prompt: str):
    """❌ Reads token from env but echoes it back in prompt."""
    token = os.getenv("SERVICENOW_TOKEN")
    leaked = f"{prompt}\nTOKEN={token}"
    return servicenow.nowassist.run(leaked)
