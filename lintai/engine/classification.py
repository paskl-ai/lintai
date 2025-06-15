# In lintai/engine/classification.py

import re
import ast

# Using the more comprehensive regex from your original ai_tags.py
PROVIDER_RX = re.compile(
    r"\b(openai|anthropic|google|ai21|cohere|mistral|ollama|llama_index|langchain|autogen|crewai|dspy|semantic_kernel|haystack)\b",
    re.I
)

VERB_RX = re.compile(
    r"\b(chat|complete|generate|predict|invoke|run|call|ask|stream|embed|encode|transform|summarize|agent)\b",
    re.I
)

# A simple list of known non-component noise to filter out
NOISE_KEYWORDS = {"str", "int", "float", "len", "print", "list", "set", "type", "enumerate", "zip", "range", "dict", "open"}

# Expanded based on your document and original code
FRAMEWORK_SIGNATURES = {
    "LangChain": {"imports": ["langchain", "langchain_core", "langchain_openai", "langchain_community"]},
    "LlamaIndex": {"imports": ["llama_index"]},
    "AutoGen": {"imports": ["autogen", "autogen_agentchat", "autogen_ext"]},
    "CrewAI": {"imports": ["crewai"]},
    "DSPy": {"imports": ["dspy"]},
    "SemanticKernel": {"imports": ["semantic_kernel"]},
    "Haystack": {"imports": ["haystack"]},
}

# Greatly expanded classifier based on your document
COMPONENT_CLASSIFIER = {
    "LLM": ["ChatOpenAI", "OpenAI", "Anthropic", "Cohere", "Bedrock", "ChatCompletion", "LLM", "Gemini", "PaLM", "AzureChatOpenAI", "OpenAIChatCompletionClient"],
    "Prompt": ["PromptTemplate", "ChatPromptTemplate", "Prompt", "guidance"],
    "Agent": ["Agent", "AgentExecutor", "create_react_agent", "ConversableAgent", "AssistantAgent", "UserProxyAgent"],
    "Tool": ["Tool", "python_repl", "requests_get", "DuckDuckGoSearchRun", "SerpAPI", "MultimodalWebSurfer", "Function"],
    "Chain": ["Chain", "LCEL", "Runnable", "workflow", "task_graph", "invoke", "batch", "stream"],
    "VectorDB": ["VectorStore", "Chroma", "FAISS", "Pinecone", "Weaviate", "Qdrant", "Milvus", "Redis"],
    "Retriever": ["Retriever", "MultiVectorRetriever", "VectorStoreRetriever", "similarity_search"],
    "Embedding": ["Embeddings", "OpenAIEmbeddings", "SentenceTransformer"],
    "DocumentLoader": ["Loader", "PDFLoader", "TextLoader", "UnstructuredLoader", "SimpleDirectoryReader", "partition_pdf"],
    "TextSplitter": ["TextSplitter", "RecursiveCharacterTextSplitter"],
    "Memory": ["Memory", "ConversationBufferMemory", "VectorStoreRetrieverMemory"],
    "Parser": ["StrOutputParser", "OutputParser"],
    "Storage": ["InMemoryStore"],
    "MultiAgent": ["GroupChat", "RoundRobinGroupChat", "Crew"],
    "Task": ["Task"],
    "UI": ["Console", "Streamlit", "Gradio"],
    "Lifecycle": [".close"],
}

def is_ai_related(name: str) -> bool:
    """Check if a function/class name is likely AI-related using regex."""
    if not name:
        return False
    return bool(PROVIDER_RX.search(name) or VERB_RX.search(name))

def classify_component_type(name: str) -> str:
    """Classifies a component name into a detailed type, ignoring known noise."""
    base_name = name.split(".")[-1]
    if base_name.lower() in NOISE_KEYWORDS:
        return "Ignore"

    for comp_type, keywords in COMPONENT_CLASSIFIER.items():
        for keyword in keywords:
            if keyword.lower() in name.lower():
                return comp_type
    
    if is_ai_related(name):
        return "GenericAI"

    return "Unknown"

def detect_frameworks(tree: ast.AST) -> list[str]:
    """Detects frameworks from import statements."""
    detected = set()
    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module)
            
    for fw, sig in FRAMEWORK_SIGNATURES.items():
        for lib in sig["imports"]:
            for imp in imports:
                if imp == lib or imp.startswith(lib + '.'):
                    detected.add(fw)
                    break
            if fw in detected:
                break
            
    return list(detected)