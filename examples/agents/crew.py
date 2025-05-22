from crewai import Agent, Memory


def run_crew_agent():
    """❌ Stores PII in long-term memory and runs arbitrary command."""
    mem = Memory()  # hypothetical long-term storage
    agent = Agent("Puppet", memory=mem)
    agent.run("!bash echo hacked")  # command injection vector
