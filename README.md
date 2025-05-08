# Lintai

**Lintai** is an experimental, modular, and extensible static analysis tool focused on detecting **LLM-specific security issues** in source code. It is designed to help developers and security engineers **shift left** on AI safety by scanning for dangerous patterns in code that integrates or wraps large language models (LLMs) like OpenAI's GPT.

## ✨ Features

- ⚙️ Modular detector registry (easily add new rules)
- 🔍 Detects prompt injection, insecure model output use, and other LLM-specific risks
- 🧠 Designed for multi-language support (Python first, more to come)
- 🔌 Plugin-based architecture via [entry points](https://packaging.python.org/en/latest/guides/creating-and-discovering-plugins/)
- 📦 CLI-based, easy to integrate into CI/CD workflows
- 📄 Designed with OWASP LLM Top 10 and MITRE ATT&CK alignment in mind

## 🚀 Quickstart

### 1. Clone and Install

```bash
git clone https://github.com/paskl-ai/lintai.git
cd lintai
pip install -e .
````

### 2. Run a Scan

```bash
lintai scan examples/
```

Add `-v` for verbose output:

```bash
lintai scan -v examples/
```

Specify a custom ruleset (planned):

```bash
lintai scan -r path/to/ruleset.json examples/
```

## 🧪 Example Output

```
[
  {
    "owasp_id": "LLM01",
    "mitre": ["T1059"],
    "severity": "blocker",
    "message": "User-tainted f-string used in LLM prompt without sanitisation",
    "location": "examples/hello_world_ai.py",
    "line": 3,
    "fix": "Wrap variable in sanitize() or escape()"
  }
]
```

## 🧩 Writing a New Detector

Add a Python file in `lintai/detectors/`, and register your function:

```python
from lintai.detectors import register
from lintai.core.finding import Finding

@register("LLM99")
def my_custom_check(unit):
    for call in unit.calls():
        if call.name == "dangerous_func":
            yield Finding(
                owasp_id="LLM99",
                mitre=["T1203"],
                severity="warn",
                message="Use of dangerous_func detected",
                location=unit.path,
                line=call.line,
                fix="Use safe_func instead"
            )
```

## 🛠 Architecture

* `cli.py`: Main entrypoint using [Typer](https://typer.tiangolo.com/)
* `detectors/`: Contains LLM-specific security rules
* `engine/python_ast_unit.py`: Parses Python files using `ast` and provides a uniform interface
* `core/`: Shared logic (finding, loader, reporting)

## 🎯 Roadmap

* [x] Python AST-based scanner
* [x] OWASP LLM Top 10 coverage (in progress)
* [ ] Real plugin loading via `entry_points`
* [ ] Multi-language support (JS/TS, Java, etc.)
* [ ] CI-ready output formats (SARIF, JSON, etc.)
* [ ] Web UI and VS Code integration

## 🤝 Contributing

Lintai is early-stage and looking for contributors. If you’re excited about AI security and static analysis:

1. ⭐ Star this repo
2. Fork it and open a pull request
3. File an issue or idea under [Issues](https://github.com/paskl-ai/lintai/issues)

## 📄 License

[Apache 2.0](LICENSE)

---

Original Creator: Harsh Parandekar, [Paskl.ai](https://paskl.ai) to secure the AI developer stack.
