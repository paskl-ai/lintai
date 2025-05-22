# 🧪 Examples for Lintai Scanning

This folder contains **intentionally insecure and illustrative examples** designed to demonstrate how Lintai detects GenAI-related risks.

## 📁 Structure

- `hello_world_ai.py` – Simple script with unsafe `eval`, hardcoded secrets, and prompt injection risks.
- `chatbot.py` – Defines unsafe OpenAI and LangChain-style usage with unsanitized inputs.
- `agents/crew.py` – Hypothetical Crewai-style agent with unsafe command execution and long-term memory storage.
- `agents/enterprise.py` – Simulates an enterprise SDK (e.g., ServiceNow) with token leakage via prompts.
- `main.py` – Calls all functions from the above modules to form a full flow.
- `secrets.py` – Hardcoded secrets file, intentionally insecure.

## 🚨 Warning

**These files are NOT safe for production.**
They are here to showcase vulnerabilities such as:

- Prompt injection
- Secret leakage
- Insecure eval
- Unsafe agent initialization
- Untrusted user input passed to LLMs

## ✅ Safe usage

Run the Lintai scanner on this folder to see how issues are reported:

```bash
lintai scan <path-to-this-folder>
