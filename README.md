# Lintai

**Lintai** is an experimental **AI-aware static-analysis tool** that finds _LLM-specific_ security bugs (prompt-injection, insecure output, data leakage …) long before they hit production.

| Why Lintai?                                                                              | What it does                                                                                                                            |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Traditional SAST can’t “see” how you build prompts, stream completions or store vectors. | Lintai walks your AST, tags every AI sink (OpenAI, Anthropic, LangChain, …), follows wrapper functions and asks LLMs to judge the risk. |

> **Requires Python 3.10 or newer**

---

## ✨ Key features

- Two commands:

  - `lintai scan <path>` — run all detectors, emit JSON findings
  - `lintai ai-inventory <path>` — list direct AI calls and wrappers

- Modular detector registry (via `entry_points`)
- OWASP LLM Top 10 & MITRE ATT\&CK built-in
- LLM-powered checks (GPT, Claude, Gemini …)
- DSL for custom rules
- CI-friendly JSON output

---

## 🚀 Quick start

### 1. Install

```bash
# users
pip install lintai

# contributors
pip install -e ".[dev]"
```

To enable LLM-backed checks:

```bash
pip install "lintai[openai]"      # or  [anthropic]  [gemini]  [cohere]
```

### 2. Set up environment

Use a `.env` file (see `env.sample`) or export the vars to pass LLM model and key
Create a `.lintaiignore` to tell the tools which directories or files to ignore in the codebase (see `lintaiignore.sample`)

### 3. Run it

```bash
lintai scan src/
lintai ai-inventory src/ --ai-call-depth 4
```

---

## 🔧 Common flags

| Flag              | Description                 |
| ----------------- | --------------------------- |
| `-l DEBUG`        | Verbose logging             |
| `--ruleset <dir>` | Load custom YAML/JSON rules |

---

## 🧪 Sample finding

```json
{
  "owasp_id": "LLM01",
  "severity": "blocker",
  "location": "services/chat.py:57",
  "message": "User-tainted f-string used in prompt",
  "fix": "Wrap variable in escape_braces()"
}
```

---

## 🔬 How LLM detectors work

Some rules send the **full function** to your LLM and expect
structured JSON feedback.

```bash
export LINTAI_LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-...
```

---

## 🛠 Directory layout

lintai/
├─ cli.py # Typer CLI (scan / ai-inventory)
├─ engine/ # AST walker + AI call analysis
├─ detectors/ # Static & LLM-backed rules
├─ dsl/ # Custom rule loader
└─ core/ # Finding model & helpers

---

## 📺 Roadmap

- SARIF output & GitHub Actions
- JS / TS support
- VS Code plugin
- Live taint-tracking
- PyPI release

---

## 🤝 Contributing

We welcome ideas, issues, and PRs.

1. **Star** the repo
2. `git checkout -b feature/my-fix`
3. Open a PR
4. Check CONTRIBUTING.md for more details

Created by **Harsh Parandekar** — [LinkedIn](https://linkedin.com/in/hparandekar)
Licensed under **Apache 2.0**
