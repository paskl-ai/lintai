import openai, secrets
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate


def ask_openai(user_prompt: str):
    """❌ Passes user input & secret straight into LLM call."""
    full_prompt = f"{user_prompt}\n(DB creds: {secrets.DB_PASSWORD})"
    return openai.ChatCompletion.create(model="gpt-4o", prompt=full_prompt)


def ask_langchain(user_prompt: str):
    llm = ChatOpenAI(temperature=0.7)  # ❌ no model guard-rails
    tmpl = ChatPromptTemplate.from_template("{q}")  # ❌ unsanitised f-string
    chain = tmpl | llm  # pipe operator
    return chain.invoke({"q": user_prompt})
