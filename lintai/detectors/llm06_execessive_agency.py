# In lintai/detectors/llm06_excessive_agency.py

import ast
from lintai.detectors import register
from lintai.core.finding import Finding
from lintai.engine.ast_utils import get_full_attr_name

# A list of dangerous function calls that grant excessive agency.
DANGEROUS_CALLS = {
    "os.system",
    "os.popen",
    "subprocess.run",
    "subprocess.call",
    "subprocess.check_call",
    "shutil.rmtree",
    "shutil.move",
}

@register("LLM06", scope="module")
def detect_excessive_agency(unit):
    """
    Detects when a function classified as a 'Tool' for an agent
    makes a call to a dangerous system-level function.
    """
    # This requires the global analyzer to have run first.
    from lintai.engine import ai_analyzer
    if not ai_analyzer:
        return

    # Find all components in this file that are Tools.
    inventory = ai_analyzer.inventories.get(str(unit.path))
    if not inventory:
        return

    tool_components = [c for c in inventory.components if c.component_type == "Tool"]
    if not tool_components:
        return
    
    # For each Tool, get its original AST node from the analyzer
    for tool_comp in tool_components:
        tool_node = ai_analyzer._qualname_to_node.get(tool_comp.name)

        if tool_node:
            # Walk the AST *inside* the tool function
            for sub_node in ast.walk(tool_node):
                if isinstance(sub_node, ast.Call):
                    call_name = get_full_attr_name(sub_node.func)
                    
                    if call_name in DANGEROUS_CALLS:
                        yield Finding(
                            detector_id="LLM06_EXCESSIVE_AGENCY",
                            owasp_id="LLM06: Excessive Agency",
                            mitre=["T1059"],
                            severity="critical",
                            message=f"Agent tool '{tool_comp.name}' has excessive agency via a call to dangerous function '{call_name}'.",
                            location=unit.path,
                            line=sub_node.lineno,
                            fix="Ensure agent tools are sandboxed and cannot execute arbitrary system commands. Use safer, more specific APIs instead of general-purpose execution."
                        )