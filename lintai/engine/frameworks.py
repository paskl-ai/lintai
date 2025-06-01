import ast

FRAMEWORK_SIGNATURES = {
    "LangChain": {
        "imports": ["langchain", "langchain_openai"],
        "classes": ["ChatOpenAI", "PromptTemplate", "Tool", "AgentExecutor"]
    },
    "AutoGen": {
        "imports": ["autogen"],
        "classes": ["Agent", "GroupChat", "AssistantAgent"]
    },
    "CrewAI": {
        "imports": ["crewai"],
        "classes": ["Crew", "Task", "Agent"]
    },
    "DSPy": {
        "imports": ["dspy"],
        "classes": ["Predict", "Module"]
    },
    "SemanticKernel": {
        "imports": ["semantic_kernel"],
        "classes": ["Kernel", "Planner"]
    }
}

def detect_frameworks(ast_tree):
    detected = set()

    imports = set()
    for node in ast.walk(ast_tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module.split('.')[0])
    
    # print("🧠 Detected imports from AST:", imports)

    for fw, sig in FRAMEWORK_SIGNATURES.items():
        if any(lib in imports for lib in sig["imports"]):
            detected.add(fw)

    return list(detected)

