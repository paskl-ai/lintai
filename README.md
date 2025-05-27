# Lintai 🛡️🤖

**Lintai** is an experimental **AI-aware static-analysis tool** that spots _LLM-specific_ security bugs (prompt-injection, insecure output, data leakage …) long before they ship.

| Why Lintai?                                                                              | What it does                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Traditional SAST can’t “see” how you build prompts, stream completions or store vectors. | Lintai walks your AST, tags every AI sink (OpenAI, Anthropic, LangChain, …), follows wrapper functions & asks an LLM to judge risk. |

> **Requires Python ≥ 3.10**

---

## ✨ Key features

- **Two analysis commands**
  - `lintai scan <path>` – run all detectors, emit JSON (incl. _llm_usage_ summary)
  - `lintai ai-inventory <path>` – list every AI call + wrapper chain
- **Browser UI** `lintai ui` – FastAPI backend, plug-in React/Cytoscape frontend
- **LLM-usage budget** – hard caps on requests / tokens / cost with live report
  `LINTAI_MAX_LLM_TOKENS  LINTAI_MAX_LLM_COST_USD  LINTAI_MAX_LLM_REQUESTS`
- Modular detector registry (`entry_points`)
- OWASP LLM Top-10 & MITRE ATT&CK baked in
- DSL for custom rules
- CI-friendly JSON / (soon) SARIF output

---

## 🚀 Quick start

### 1 · Install

```bash
# end users
pip install lintai

# full dev experience (tests, UI)
pip install -e ".[dev,ui]"
```

Enable LLM-backed checks:

```bash
pip install "lintai[openai]"      # or  [anthropic]  [gemini]  [cohere]
```

### 2 · Configure

```bash
# .env  (see env.sample)
OPENAI_API_KEY=sk-...
LINTAI_MAX_LLM_TOKENS=50_000
LINTAI_MAX_LLM_COST_USD=10
```

`lintai` auto-loads `.env` (no override of real env-vars).

### 3 · Run

```bash
lintai scan src/
lintai ai-inventory src/ --ai-call-depth 4
```

### 4 · Launch UI (optional)

```bash
lintai ui                  # http://localhost:8501/api/docs  (REST)
yarn -C lintai/ui/frontend start   # React dev-server on :5173
```

---

## 🔧 Common flags

| Flag              | Description                              |
| ----------------- | ---------------------------------------- |
| `-l DEBUG`        | Verbose logging                          |
| `--ruleset <dir>` | Load custom YAML/JSON rules              |
| `--output <file>` | Write full JSON report instead of stdout |

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

## 🔬 How LLM detectors work

Some rules send the **full function source** to an LLM and expect one-line JSON back:

```bash
export LINTAI_LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-...
```

Budgets are enforced _before_ the call and itemised afterwards.

---

## 📦 Directory layout

lintai/
├─ cli.py ← Typer entry-point
├─ ui/ ← FastAPI backend + React frontend stub
├─ engine/ ← AST walker & AI-call analysis
├─ detectors/ ← Static & LLM-powered rules
├─ dsl/ ← Custom rule loader
└─ core/ ← Finding model, token-budget manager …

---

## 🌐 REST API cheat-sheet

| Method & path                | Body / Params      | Purpose                             |
| ---------------------------- | ------------------ | ----------------------------------- |
| `GET  /api/health`           | –                  | Liveness probe                      |
| `GET  /api/config`           | –                  | Read current config                 |
| `POST /api/config`           | `ConfigModel` JSON | Update settings (path, depth …)     |
| `POST /api/scan`             | multipart files    | Run detectors on uploaded code      |
| `POST /api/inventory`        | `path=<dir>`       | Inventory run on server-side folder |
| `GET  /api/runs`             | –                  | List all runs + status              |
| `GET  /api/results/{run_id}` | –                  | Fetch scan / inventory report       |

OpenAPI docs auto-generated at **`/api/docs`**.

---

## 📺 Roadmap

- SARIF & GitHub-Actions template
- VS Code extension (uses above REST)
- Live taint-tracking
- JavaScript/TypeScript support

---

## 🤝 Contributing

1. **Star** the repo ⭐
2. `git checkout -b feat/my-fix`
3. `pytest -q` (all green)
4. Open a PR – or a draft PR early
5. See `CONTRIBUTING.md`

Created by **Harsh Parandekar** — [LinkedIn](https://linkedin.com/in/hparandekar)
Licensed under **Apache 2.0**
