# examples/bare_except.py
# ❌ Bare except hides all errors (and interrupts debugging)
def read_config(path):
    try:
        with open(path) as f:
            return f.read()
    except:
        # We don’t even log what went wrong!
        return None


if __name__ == "__main__":
    print(read_config("/etc/app/config.yml"))
