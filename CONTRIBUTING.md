# Contributing to Lintai

🚀 Thanks for your interest in contributing to **Lintai** – an experimental static scanner for LLM-specific security issues. Your contributions help advance safer AI coding practices.

---

## 🧱 Getting Started

1. **Clone the repository**:

   ```bash
   git clone https://github.com/paskl-ai/lintai.git
   cd lintai
   ```

2. **Set up a virtual environment**:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   ```

3. **Run tests**:

   ```bash
   pytest
   ```

4. **Try a scan**:

   ```bash
   lintai scan examples/
   ```

---

## ✍️ Writing a New Detector

1. Add a file in `lintai/detectors/`, e.g. `llm03_your_detector.py`.

2. Use the decorator to register it:

   ```python
   from lintai.detectors import register
   from lintai.core.finding import Finding

   @register("LLM03")
   def detect_something(unit):
       for call in unit.calls():
           if call.name == "some_risky_func":
               yield Finding(
                   owasp_id="LLM03",
                   mitre=["T1203"],
                   severity="warn",
                   message="Dangerous function usage",
                   location=unit.path,
                   line=call.line,
                   fix="Use safe_func instead"
               )
   ```

3. Add a test in `tests/` and run `pytest`.

---

## 🧼 Code Style

* Follow [Black](https://black.readthedocs.io/) for formatting:

  ```bash
  black lintai/
  ```

* Use `pytest` for tests

* Keep detectors small and focused

* Document any new functionality or config flags in `README.md` or help text

---

## 📦 Submitting Changes

1. **Create a new branch**:

   ```bash
   git checkout -b feature/llm03-detector
   ```

2. **Make your changes, commit, and push**:

   ```bash
   git commit -am "Add LLM03 detector for risky function"
   git push origin feature/llm03-detector
   ```

3. **Open a Pull Request** on GitHub and describe your changes clearly.

---

## 🙏 Thanks

Lintai is early-stage and community contributions are incredibly valuable. Thank you for helping push LLM security forward!

— Harsh Parandekar, [paskl.ai](https://paskl.ai)
