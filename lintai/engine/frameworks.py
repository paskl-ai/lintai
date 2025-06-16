import ast

FRAMEWORK_SIGNATURES = {
    "LangChain": {
        "imports": ["langchain", "langchain_openai"],
        "classes": ["ChatOpenAI", "PromptTemplate", "Tool", "AgentExecutor"],
    },
    "AutoGen": {
        "imports": ["autogen", "autogen_agentchat", "autogen_ext"],
        "classes": [
            "Agent",
            "AssistantAgent",
            "UserProxyAgent",
            "GroupChat",
            "RoundRobinGroupChat",
            "MultimodalWebSurfer",
        ],
    },
    "CrewAI": {"imports": ["crewai"], "classes": ["Crew", "Task", "Agent"]},
    "DSPy": {"imports": ["dspy"], "classes": ["Predict", "Module"]},
    "SemanticKernel": {
        "imports": ["semantic_kernel"],
        "classes": ["Kernel", "Planner"],
    },
}


def detect_frameworks(ast_tree):
    detected = set()
    imports = set()

    for node in ast.walk(ast_tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                full = alias.name
                top = alias.name.split(".")[0]
                imports.add(full)
                imports.add(top)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                full = node.module
                top = node.module.split(".")[0]
                imports.add(full)
                imports.add(top)

    for fw, sig in FRAMEWORK_SIGNATURES.items():
        if any(lib in imports for lib in sig["imports"]):
            detected.add(fw)

    return list(detected)
