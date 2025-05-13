# Lintai

**Lintai** is an experimental, modular, and extensible static analysis tool focused on detecting **LLM-specific security issues** in source code. It is designed to help developers and security engineers **shift left** on AI safety by scanning for dangerous patterns in code that integrates or wraps large language models (LLMs) like OpenAI's GPT or Azure OpenAI.

## 🤔 Why Lintai?

Large language model (LLM) apps introduce new classes of vulnerabilities: prompt injection, insecure output handling, data leakage, and more. Traditional static analysis tools don’t catch these. **Lintai** fills that gap — offering LLM-aware static analysis so you can catch AI-related security issues before they reach production.

## ✨ Features

- ⚙️ Modular detector registry (easily add new rules)
- 🔍 Built-in detectors for prompt injection, insecure model output, and more
- 🧠 Support for LLM-backed detectors using OpenAI, Azure, Claude, etc.
- 🧩 DSL-based custom rule support
- 🔌 Plugin-ready architecture via [`entry_points`](https://packaging.python.org/en/latest/guides/creating-and-discovering-plugins/)
- 🧪 Designed with OWASP LLM Top 10 and MITRE ATT&CK alignment
- 📦 CLI-based, easy to integrate into CI/CD workflows

## 🚀 Quickstart

### 1. Clone and Install

```bash
git clone https://github.com/paskl-ai/lintai.git
cd lintai
pip install -e .
```

### 2. Choose an LLM Provider (optional)

Lintai installs **without any heavy LLM SDKs** by default.

To use LLM-powered detectors (e.g., dynamic code audits using GPT or Claude), install the required provider:

```bash
pip install "lintai[openai]"      # For OpenAI or Azure OpenAI
pip install "lintai[anthropic]"   # For Claude via Anthropic
```

See `.env.example` for setting provider-specific environment variables.

### 3. Run a Scan

Basic scan:

```bash
lintai scan examples/
```

With debug logs:

```bash
lintai scan -l DEBUG examples/
```

With a custom ruleset:

```bash
lintai scan -r lintai/dsl/rules examples/
```

With a specific environment file:

```bash
lintai scan -e /path/to/prod.env examples/
```

## 🧪 Example Output

```json
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

## 🔍 Writing a New Detector

Add a Python file in `lintai/detectors/`, and register your detector using the `@register()` decorator:

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

Or define node-specific detectors with scope:

```python
@register("LLM88", scope="node", node_types=(ast.Call,))
def node_level_check(unit):
    call = unit._current
    if is_untrusted(call):
        ...
```

## 🛠 Architecture

- `cli.py`: Typer-based CLI entry point
- `detectors/`: All rule definitions and LLM security detectors
- `llm/`: SDK accessors for OpenAI, Azure, Claude, etc.
- `engine/python_ast_unit.py`: AST parsing and helper methods
- `core/`: Shared logic for findings, plugin loader, reporting
- `dsl/`: YAML/JSON-based declarative rules

## 📄 .env Example

A sample environment file for enabling LLM-based detectors:

```dotenv
###############################################
#  Lintai – example .env for LLM providers   #
###############################################

# --- Select provider -----------------------------
# Options: openai  azure  anthropic/claude  gemini  cohere  dummy
LINTAI_LLM_PROVIDER=azure

# --- Azure OpenAI -------------------------------
AZURE_OPENAI_API_KEY=sk-xxxxxxxx
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2025-01-01-preview

# --- OpenAI Shared Settings ----------------------
OPENAI_MODEL=gpt-4.1-mini  # Model name = deployment name for Azure

# --- Anthropic Claude ----------------------------
ANTHROPIC_API_KEY=sk-anthropic-xxxx

# --- Google Gemini / PaLM2 -----------------------
GOOGLE_API_KEY=AIzaSyXXXXXX

# --- Cohere command-R ----------------------------
COHERE_API_KEY=_cstxxxxx
```

## 🎯 Roadmap

- [x] Python AST-based scanner
- [x] Rule DSL with JSON/YAML support
- [x] LLM Powered Detectors
- [x] OWASP LLM Top 10 alignment
- [ ] LLM fine-tuned detectors (e.g. DeBERTa, Phi)
- [ ] Multi-language support (JavaScript, Java)
- [ ] CI-ready output (SARIF)
- [ ] Web UI and VS Code plugin

## 🤝 Contributing

Lintai is early-stage and growing fast. Contributions welcome!

1. ⭐ Star this repo
2. Fork and open a PR
3. File ideas or bugs via [Issues](https://github.com/paskl-ai/lintai/issues)

## 📄 License

[Apache 2.0](LICENSE)

---
