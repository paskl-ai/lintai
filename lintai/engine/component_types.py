from lintai.components.langchain import LANGCHAIN_COMPONENTS
from lintai.components.autogen import AUTOGEN_COMPONENTS
from lintai.components.crewai import CREWAI_COMPONENTS
from lintai.components.dspy import DSPY_COMPONENTS

GENERIC_COMPONENTS = {
    # OpenAI SDK
    "openai.ChatCompletion.create": "LLM",
    "openai.Completion.create": "LLM",
    # Helpful built-ins we still want
    "eval": "DangerousExec",
    "input": "IO",
    # LangChain helpers
    "StrOutputParser": "Parser",
    "OpenAIEmbeddings": "Embedding",
    "Chroma": "VectorDB",
    "RunnablePassthrough": "Chain",
    "chain.invoke": "Chain",
    "summarize_chain.batch": "Chain",
    "InMemoryStore": "Storage",
    "MultiVectorRetriever": "Retriever",
    "partition_pdf": "DocumentParser",
    # Prompt variables / text
    "prompt_text": "Prompt",
}

# Merge all known mappings
SINK_TYPE_MAP = {
    **LANGCHAIN_COMPONENTS,
    **AUTOGEN_COMPONENTS,
    **CREWAI_COMPONENTS,
    **DSPY_COMPONENTS,
    **GENERIC_COMPONENTS,
}

NOISE_SINKS = {
    "str",
    "int",
    "float",
    "len",
    "print",
    "list",
    "set",
    "type",
    "enumerate",
    "zip",
    "system",
    "get_ipython",
    "Document",
    "Element",
    "uuid",
    "uuid4",
    "os.getenv",
    "keys",
    "append",
    "getenv",
    "add_documents",
    "mset",
    "vectorstore",
    "docstore",
}


def classify_sink(sink: str) -> str:
    base = sink.split(".")[-1]  # final identifier only

    if base in NOISE_SINKS:
        return "Ignore"

    for key in SINK_TYPE_MAP:
        if key in sink:
            return SINK_TYPE_MAP[key]

    # Heuristics
    if sink.endswith((".run", ".run_stream")):
        return "Chain"
    if sink.endswith(".close"):
        return "Lifecycle"
    if base == "main":
        return "EntryPoint"

    return "Unknown"
