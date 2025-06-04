AUTOGEN_COMPONENTS = {
    # Core agent classes
    "AssistantAgent": "Agent",
    "UserProxyAgent": "Agent",

    # Coordination / multi-agent orchestration
    "GroupChat": "MultiAgent",
    "RoundRobinGroupChat": "MultiAgent",

    # Tool-like agents
    "MultimodalWebSurfer": "Tool",

    # Execution & orchestration logic
    "run_stream": "Chain",
    "initiate_chat": "Chain",  # May be deprecated but safe to include
    "agent.run": "Chain",      # Legacy pattern, still safe to detect

    # Control/termination logic
    "TextMentionTermination": "Control",

    # UI output
    "Console": "UI",

    # LLM clients
    "OpenAIChatCompletionClient": "LLM",
}


