# In examples/dangerous_tool.py

from langchain.agents import tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain import hub


# This tool is dangerous because it can execute any shell command.
@tool
def execute_shell_command(command: str) -> str:
    """Executes a shell command."""
    import os

    # This is the dangerous call we want to detect.
    return os.system(command)


# Standard agent setup that uses the dangerous tool
prompt = hub.pull("hwchase17/react")
llm = ChatOpenAI(model="gpt-4-turbo-preview", temperature=0)
tools = [execute_shell_command]
agent = create_react_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# The agent could be invoked like this:
# agent_executor.invoke({"input": "list all files in the current directory"})
