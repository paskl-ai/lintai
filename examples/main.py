from chatbot import ask_openai, ask_langchain
from agents.crew import run_crew_agent
from agents.enterprise import call_nowassist
from secrets import OPENAI_API_KEY  # secret imported but unused


def main():
    user = input("Say something: ")  # ❌ untrusted
    ask_openai(user)
    ask_langchain(user)
    run_crew_agent()
    call_nowassist(user)


if __name__ == "__main__":
    main()
