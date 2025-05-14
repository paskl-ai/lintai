# Lintai

**Lintai** is an experimental, modular, and extensible static analysis tool focused on detecting **LLM-specific security issues** in source code. It is designed to help developers and security engineers **shift left** on AI safety by scanning for dangerous patterns in code that integrates or wraps large language models (LLMs) like OpenAI's GPT, Claude, or Azure OpenAI.

## 🤔 Why Lintai?

Large language model (LLM) apps introduce new classes of vulnerabilities: prompt injection, insecure output handling, data leakage, and more. Traditional static analysis tools don’t catch these. **Lintai** fills that gap — offering LLM-aware static analysis so you can catch AI-related security issues before they reach production.

## ✨ Features

- ⚙️ Modular detector registry (easily add new rules)
- 🔍 Built-in detectors for prompt injection, insecure model output, prompt leakage, and more
- 🧠 LLM-powered detectors using OpenAI, Azure, Claude, Cohere, or Gemini
- 🧩 DSL-based custom rule support
- 🔌 Plugin-ready architecture via [`entry_points`](https://packaging.python.org/en/latest/guides/creating-and-discovering-plugins/)
- 🧪 Aligned with OWASP LLM Top 10 and MITRE ATT&CK
- 📦 CLI-based, CI/CD-friendly workflows

## 🚀 Quickstart

### 1. Clone and Install

```bash
git clone https://github.com/paskl-ai/lintai.git
cd lintai
pip install -e .
```

### 2. Choose an LLM Provider (optional)

Lintai installs **without heavy LLM SDKs** by default.
To use LLM-backed detectors (e.g., dynamic code audits with GPT or Claude), install:

```bash
pip install "lintai[openai]"      # OpenAI or Azure
pip install "lintai[anthropic]"   # Claude
pip install "lintai[gemini]"      # Google Gemini
pip install "lintai[cohere]"      # Cohere
```

See `.env.example` for required environment variables.

### 3. Run a Scan

Basic scan:

```bash
lintai scan examples/
```

Debug output:

```bash
lintai scan -l DEBUG examples/
```

Custom ruleset:

```bash
lintai scan -r lintai/dsl/rules examples/
```

Use an `.env` file:

```bash
lintai scan -e .env examples/
```

Ignore third-party paths:

```bash
lintai scan --exclude '.venv/*,site-packages/*,build/*' .
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

## 🔬 LLM-Powered Detectors

Certain detectors dynamically ask an LLM (e.g. GPT, Claude) to validate code snippets. This enables deeper audit of prompt injection or leakage patterns. To use them:

1. Install an LLM provider (see above)
2. Set `LINTAI_LLM_PROVIDER` and matching API keys in your `.env`
3. Run scans as usual

**Pro Tip:** You can force LLM audits to use structured response by adding:

```python
response_format={"type": "json_object"}
```

## 🧩 Writing a New Detector

Add a Python file in `lintai/detectors/`, and register your detector:

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

Use scope filters:

```python
@register("LLM88", scope="node", node_types=(ast.Call,))
def node_level_check(unit):
    call = unit._current
    if is_user_tainted(call):
        ...
```

## 📁 .lintaiignore.sample

Recommended ignore file:

```bash
# Lintai ignore file — excludes third-party and build artifacts
.venv/
build/
site-packages/
__pycache__/
.aws-sam/
*.egg-info/
node_modules/
```

To enable, rename this to `.lintaiignore` in the project root.

## 📄 .env Example

```dotenv
###############################################
#  Lintai – example .env for LLM providers   #
###############################################

# --- Select provider -----------------------------
# Options: openai  azure  anthropic  gemini  cohere  dummy
LINTAI_LLM_PROVIDER=azure

# --- Azure OpenAI -------------------------------
AZURE_OPENAI_API_KEY=sk-xxxxxxxx
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2025-01-01-preview

# --- Shared Setting for OpenAI and Azure --------
OPENAI_MODEL=gpt-4.1-mini

# --- Anthropic Claude ----------------------------
ANTHROPIC_API_KEY=sk-anthropic-xxxx

# --- Google Gemini / PaLM2 -----------------------
GOOGLE_API_KEY=AIzaSyXXXXXX

# --- Cohere command-R ----------------------------
COHERE_API_KEY=_cstxxxxx
```

## 🛠 Architecture

- `cli.py`: Typer-based CLI
- `detectors/`: Static and LLM-backed rules
- `llm/`: Provider clients (OpenAI, Claude, Gemini, etc.)
- `engine/`: AST visitor engine and source unit abstraction
- `core/`: Core types (Finding, Loader, Reporting)
- `dsl/`: Rule definitions in YAML/JSON

## 🎯 Roadmap

- [x] Python AST-based scanner
- [x] LLM-backed detectors (GPT, Claude, etc.)
- [x] DSL support for declarative rules
- [x] OWASP LLM Top 10 alignment
- [ ] SARIF + CI/CD output
- [ ] Multi-language support (JS, Java)
- [ ] VS Code integration

## 🤝 Contributing

Lintai is early-stage and growing fast. Contributions welcome!

1. ⭐ Star this repo
2. Fork and open a PR
3. File ideas or bugs via [Issues](https://github.com/paskl-ai/lintai/issues)

## 📄 License

[Apache 2.0](LICENSE)

---
