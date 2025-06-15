# In lintai/detectors/llm02_secret_in_prompt.py

import ast
import re
from lintai.detectors import register
from lintai.core.finding import Finding
from lintai.engine.ast_utils import get_full_attr_name

# A regex to find variable names that look like secrets
SECRET_VAR_REGEX = re.compile(r"secret|password|passwd|pwd|key|token|api_key", re.I)

@register("LLM02", scope="module")
def detect_secret_in_prompt(unit):
    """
    Detects when a variable with a suspicious name (e.g., 'secret', 'key')
    is used inside an f-string that is passed to an LLM prompt.
    """
    
    # --- Pass 1: Find all variables that are assigned a tainted f-string ---
    tainted_variables = {}
    for node in ast.walk(unit.tree):
        if isinstance(node, ast.Assign):
            if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                target_var_name = node.targets[0].id
                if isinstance(node.value, ast.JoinedStr):
                    for value_node in node.value.values:
                        if isinstance(value_node, ast.FormattedValue) and isinstance(value_node.value, ast.Name):
                            if SECRET_VAR_REGEX.search(value_node.value.id):
                                tainted_variables[target_var_name] = node.lineno

    # --- Pass 2: Check if any tainted variables are used in an LLM call ---
    for node in ast.walk(unit.tree):
        # We only care about Call nodes
        if not isinstance(node, ast.Call):
            continue

        # --- THIS IS THE CORRECTED LOGIC ---
        call_name = get_full_attr_name(node.func)
        if "ChatCompletion.create" not in call_name:
            continue
        
        prompt_arg = None
        for kw in node.keywords:
            if kw.arg in ("prompt", "messages"):
                prompt_arg = kw.value
                break
        
        if not prompt_arg:
            continue

        for arg_node in ast.walk(prompt_arg):
            if isinstance(arg_node, ast.Name) and arg_node.id in tainted_variables:
                yield Finding(
                    detector_id="LLM02_SECRET_IN_PROMPT",
                    owasp_id="A02:Sensitive Data Leakage",
                    mitre=["T1552"], 
                    severity="high",
                    message=f"Variable '{arg_node.id}' containing a secret is used directly in an LLM prompt.",
                    location=unit.path,
                    line=node.lineno,
                    fix="Ensure secrets are not passed directly into prompts. Use environment variables or a secret manager at runtime."
                )
                # We found it, no need to check other args for this call
                break