# Contributing to Lintai

🚀 Thanks for helping make Lintai better!

---

## 🛠 Getting started

1. Clone:

```bash
git clone https://github.com/paskl-ai/lintai.git
cd lintai
```

1. Create virtualenv:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
# Optional: add LLM SDKs
pip install -e ".[dev,openai]"
```

1. Install pre-commit:

```bash
pre-commit install
```

1. Run tests:

```bash
pytest
```

1. Try a scan:

```bash
lintai scan examples/
```

---

## 🔍 Pre-commit hooks

Enabled by default:

- `trailing-whitespace`
- `end-of-file-fixer`
- `black` (auto-formats code)

Manually run all:

```bash
pre-commit run --all-files
```

---

## ✍️ Writing a new detector

Create a new file in `lintai/detectors/`, e.g.:

```python
from lintai.detectors import register
from lintai.core.finding import Finding

@register("LLM03")
def detect_something(unit):
    for call in unit.calls():
        if call.name == "some_func":
            yield Finding(
                owasp_id="LLM03",
                mitre=["T1203"],
                severity="warn",
                message="Bad function call",
                location=unit.path,
                line=call.lineno,
                fix="Use safe_func() instead",
            )
```

Then add a test in `tests/` and run `pytest`.

---

## 🎨 Code style

- **Black** (88-col): formatting enforced by pre-commit
- Type hints welcome
- Use `pytest`
- Keep rules small & focused

---

## 📦 Submitting a PR

1. Branch:

```bash
git checkout -b feature/my-fix
```

1. Make your changes. Run black. Then commit & push:

```bash
black .
git commit -am "Add new LLM detector"
git push origin feature/my-fix
```

1. Open a Pull Request on GitHub.

---

## 🙏 Thank you

We’re in early days. Your help is super valuable!

— Harsh Parandekar, [paskl.ai](https://paskl.ai)
