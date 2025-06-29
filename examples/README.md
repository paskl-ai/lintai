# 🧪 Examples for Lintai Scanning

This folder contains **intentionally insecure and illustrative examples** designed to demonstrate how Lintai detects GenAI-related risks.

## 📁 Structure

- `hello_world_ai.py` – Simple script with unsafe `eval`, hardcoded secrets, and prompt injection risks.
- `chatbot.py` – Defines unsafe OpenAI and LangChain-style usage with unsanitized inputs.
- `dangerous_tool.py` – Agent tool with excessive agency (uses `os.system` for shell execution).
- `agents/crew.py` – Hypothetical Crewai-style agent with unsafe command execution and long-term memory storage.
- `agents/enterprise.py` – Simulates an enterprise SDK (e.g., ServiceNow) with token leakage via prompts.
- `autogen/` – AutoGen framework examples with multi-agent conversations.
- `main.py` – Calls all functions from the above modules to form a full flow.
- `secrets.py` – Hardcoded secrets file, intentionally insecure.

## 🚨 Warning

**These files are NOT safe for production.**
They are here to showcase vulnerabilities such as:

- Prompt injection (LLM01)
- Secret leakage (LLM02)
- Excessive agency in AI agents (LLM06)
- Insecure eval
- Unsafe agent initialization
- Untrusted user input passed to LLMs

## ✅ Safe usage

Run the Lintai scanner on this folder to see how issues are reported:

```bash
# Scan entire directory
lintai scan examples/

# Scan specific files (demonstrates cross-file analysis)
lintai scan examples/main.py examples/chatbot.py

# Generate inventory with call graph
lintai ai-inventory examples/ --graph --output inventory.json

# Multiple files with debug output
lintai scan examples/main.py examples/chatbot.py examples/agents/ -l DEBUG
```

### Cross-file Analysis Example

The examples demonstrate cross-file relationships:

- `main.py` calls functions in `chatbot.py` and `agents/`
- Lintai tracks these relationships and includes caller context in security analysis
- LLM detectors receive enhanced prompts showing how functions are called from other files
