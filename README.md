# Lintai

**Lintai** is an experimental **AI-aware static-analysis tool** that spots _LLM-specific_ security bugs (prompt-injection, insecure output handling, data-leakage …) **before** code ships.

| Why Lintai?                                                                              | What it does                                                                                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Traditional SAST can’t “see” how you build prompts, stream completions or store vectors. | Lintai walks your AST, tags every AI sink (OpenAI, Anthropic, LangChain, …), follows wrapper chains, then asks an LLM to judge risk. |

> **Requires Python ≥ 3.10**

---

## ✨ Key features

- **Two analysis commands with multi-file support**
  - `lintai ai-inventory <files-or-dirs>...` – list every AI call and its caller chain across multiple files
  - `lintai scan <files-or-dirs>...` – run all detectors on multiple files/directories, emit JSON (with _llm_usage_ summary)
- **Cross-file analysis** – tracks function calls and AI usage patterns across file boundaries
- **LLM budget guard-rails** – hard caps on requests / tokens / cost (`LINTAI_MAX_LLM_*`)
- **Enhanced call-flow context** – LLM detectors receive caller/callee context from other files for better analysis
- **OWASP LLM Top-10 detectors** – including LLM01 (Prompt Injection), LLM02 (Data Leakage), LLM06 (Excessive Agency)
- **Multi-framework support** – OpenAI, Anthropic, LangChain, CrewAI, AutoGen, and more
- Modular detector registry (`entry_points`)
- OWASP LLM Top-10 & MITRE ATT&CK baked in
- DSL for custom rules
- CI-friendly JSON output (SARIF soon)

### ⚠️ UI Notice

A React/Cytoscape UI is under active development – not shipped in this cut.

---

## 🚀 Quick start

### 1 · Install

```bash
pip install lintai                    # core only
pip install "lintai[openai]"          # + OpenAI detectors
# or  "lintai[anthropic]"  "lintai[gemini]"  "lintai[cohere]"
pip install "lintai[ui]"              # FastAPI server extras
```

### 2 · Enable LLM detectors (optional but highly recommended)

```bash
# .env  (minimal)
LINTAI_LLM_PROVIDER=openai                # azure / anthropic / gemini / cohere / dummy
LLM_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx    # API key for above provider

# provider-specific knobs
LLM_MODEL_NAME=gpt-4.1-mini
LLM_ENDPOINT_URL=https://api.openai.com/v1/
LLM_API_VERSION=2025-01-01-preview         # Required for Azure

# hard budget caps
LINTAI_MAX_LLM_TOKENS=50000
LINTAI_MAX_LLM_COST_USD=10
LINTAI_MAX_LLM_REQUESTS=500
```

Lintai auto-loads `.env`; the UI writes the same file, so CLI & browser stay in sync.

### 3 · Run

```bash
# Single file or directory
lintai ai-inventory src/ --ai-call-depth 4
lintai scan src/

# Multiple files and directories
lintai scan file1.py file2.py src/ tests/
lintai ai-inventory examples/main.py examples/chatbot.py --graph

# Mixed arguments work too
lintai scan examples/main.py examples/agents/ --output report.json
```

### 4 · Launch REST server (Optional, React UI coming soon)

```bash
lintai ui                     # REST docs at http://localhost:8501/api/docs
```

---

## 🔬 How LLM detectors work

LLM-powered rules collect the **full source** of functions that call AI frameworks, plus their caller chain **across multiple files**, and ask an external LLM to classify OWASP risks.

The enhanced analysis includes:

- **Cross-file call tracking** – detectors see how functions in one file call AI functions in another
- **Caller context** – LLM prompts include snippets from calling functions to provide better security analysis
- **Call-flow context** – both direct callers and callees are included for comprehensive risk assessment

Budget checks run _before_ the call; actual usage is recorded afterwards.

---

## 🔧 Common flags

| Flag              | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `-l DEBUG`        | Verbose logging                                      |
| `--ruleset <dir>` | Load custom YAML/JSON rules                          |
| `--output <file>` | Write full JSON report instead of stdout             |
| `--graph`         | Include call-graph visualization data (ai-inventory) |
| `--ai-call-depth` | How many caller layers to trace for relationships    |

---

## 🧪 Sample `scan` output

```json
{
  "llm_usage": {
    "tokens_used": 3544,
    "usd_used": 0.11,
    "requests": 6,
    "limits": { "tokens": 50000, "usd": 10, "requests": 500 }
  },
  "findings": [
    {
      "owasp_id": "LLM01",
      "severity": "blocker",
      "location": "services/chat.py:57",
      "message": "User-tainted f-string used in prompt",
      "fix": "Wrap variable in escape_braces()"
    }
  ]
}
```

---

## 📦 Directory layout

lintai/
├── cli.py Typer entry-point
├── engine/ AST walker & AI-call analysis
├── detectors/ Static & LLM-backed rules
├── dsl/ Custom rule loader
├── llm/ Provider clients & token-budget manager
├── components/ Maps common AI frameworks → canonical types
├── core/ Finding & report model
├── ui/ FastAPI backend (+ React UI coming soon)
└── tests/ Unit / integration tests

examples/ Sample code with insecure AI usage

## 🌐 REST API cheat-sheet

| Method & path            | Body / Params        | Purpose                             |
| ------------------------ | -------------------- | ----------------------------------- |
| `GET  /api/health`       | –                    | Liveness probe                      |
| `GET  /api/config`       | –                    | Read current config                 |
| `POST /api/config`       | `ConfigModel` JSON   | Update settings (path, depth …)     |
| `GET /POST /api/env`     | `EnvPayload` JSON    | Read / update non-secret .env       |
| `POST /api/secrets`      | `SecretPayload` JSON | Store API key (write-only)          |
| `POST /api/scan`         | multipart files      | Run detectors on uploaded code      |
| `POST /api/inventory`    | `path=<dir>`         | Inventory run on server-side folder |
| `GET  /api/runs`         | –                    | List all runs + status              |
| `GET  /api/results/{id}` | –                    | Fetch scan / inventory report       |

Auto-generated OpenAPI docs live at **`/api/docs`**.

---

## 📺 Roadmap

- React JS UI support
- SARIF + GitHub Actions template
- Additional AI frameworks recognition and categorization
- Lintai VS Code extension
- Live taint-tracking

---

## 🤝 Contributing

1. **Star** the repo ⭐
2. `git checkout -b feat/my-fix`
3. `pytest -q` (all green)
4. Open a PR – or a draft PR early
5. See `CONTRIBUTING.md`

### 🎨 Frontend Development

The UI is a React/TypeScript application. For development:

```bash
# Frontend development
cd lintai/ui/frontend
npm install
npm run dev    # Start dev server

# Build for production (development only)
python scripts/build-frontend.py
```

**Note**: Built frontend assets are not committed to git. They are built automatically during CI/CD for releases.

---

## 👥 Contributors

- **Harsh Parandekar** ([@hparandekar](https://github.com/hparandekar)) - Creator, core engine, multi-file analysis
- **Hitesh Kapoor** ([@hkapoor246](https://github.com/hkapoor246)) - Analysis engine rewrite, LLM06 & LLM02 detectors
- **Kundan Ray** ([@kundanray1](https://github.com/kundanray1)) - React UI development and dashboard enhancements

---

Created by **Harsh Parandekar** — [LinkedIn](https://linkedin.com/in/hparandekar)
Licensed under **Apache 2.0**
