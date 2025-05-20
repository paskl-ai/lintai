````markdown
# Lintai

**Lintai** is an experimental **AI-aware static-analysis tool** that finds _LLM-specific_ security bugs (prompt-injection, insecure output, data leakage …) long before they hit production.

| Why Lintai?                                                                              | What it does                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Traditional SAST can’t “see” how you build prompts, stream completions or store vectors. | Lintai walks your AST, tags every AI sink (OpenAI, Anthropic, LangChain, …), follows wrapper functions and asks purpose-built detectors & LLMs to judge the risk. |

---

## ✨ Key features

- **Two commands**
  - `lintai scan <path>` — run all detectors, emit JSON findings
  - `lintai ai-inventory <path>` — print every _direct_ AI call **plus** the wrapper functions that reach it
- Modular detector registry (plug-in via `entry_points`)
- Built-in rules for OWASP LLM Top 10 & MITRE ATT&CK
- **LLM-powered** deep checks (uses GPT, Claude, Gemini, …)
- DSL for custom rules (`yaml` / `json`)
- CI-friendly JSON output

---

## 🚀 Quick start

```bash
# 1. install core (no heavy SDKs)
pip install lintai

# 2. optional – add an LLM provider for deep audits
pip install "lintai[openai]"        # or  [anthropic]  [gemini]  [cohere]

# 3. set keys (create .env file based on env.sample) or export environment variables

# 4. scan!
lintai scan src/

# 5. list all AI sinks & wrappers
lintai ai-inventory src/             # --ai-call-depth 4  to walk higher
```
````

Verbose logging:

```bash
lintai scan src/ --log-level DEBUG
```

Custom rules:

```bash
lintai scan src/ --ruleset my_rules/
```

---

## 🧪 Sample finding

```json
{
  "owasp_id": "LLM01",
  "severity": "blocker",
  "location": "services/chat.py:57",
  "message": "User-tainted f-string used in system-prompt without sanitisation",
  "fix": "Wrap variable in escape_braces()"
}
```

---

## 🔬 How LLM-powered detectors work

Some rules send the _full surrounding function_ to your chosen model (GPT-4o, Claude 3, …) and ask for a structured JSON verdict.
Enable them by installing a provider extra and exporting the matching API key:

```bash
export LINTAI_LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-...
```

---

## 🛠 Directory layout

```
lintai/
 ├─ cli.py            # Typer CLI (scan / ai-inventory)
 ├─ engine/           # AST walker + AI call analysis
 ├─ detectors/        # Static & LLM-backed rules
 ├─ dsl/              # Custom rule loader
 └─ core/             # Finding model & helpers
```

---

## 🗺 Roadmap

- SARIF output & GitHub Actions
- JS / TS support
- VS Code extension
- Live taint-tracking

---

## 🤝 Contributing

Bug reports, ideas and PRs are welcome!

1. **Star** the repo
2. `git checkout -b feature/my-idea`
3. Open a PR

## Creator

Created by **Harsh Parandekar** – feel free to reach out on ☁️ https://linkedin.com/in/hparandekar ☁️.

Licensed under **Apache 2.0**.
