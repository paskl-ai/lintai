LANGCHAIN_COMPONENTS = {
    "langchain.chat_models.ChatOpenAI": "LLM",
    "ChatOpenAI": "LLM",
    "|model": "LLM",  # handle pipe-style chains better
    "langchain.storage.InMemoryStore": "Storage",
    "langchain.retrievers.multi_vector.MultiVectorRetriever": "Retriever",
    "langchain.prompts.ChatPromptTemplate.from_template": "Prompt",
    "ChatPromptTemplate.from_template": "Prompt",
    "Tool": "Tool",
    "AgentExecutor": "Chain",
    "tmpl": "Prompt",
    "tmpl | llm": "Chain",
    "FAISS": "VectorDB",
    "RetrievalQA": "Chain"
}

