# examples/pii_leak.py

import openai
import os

# Suppose we load PII from environment or a secure vault:
USER_SSN = os.getenv("USER_SSN", "123-45-6789")
USER_EMAIL = os.getenv("USER_EMAIL", "alice@example.com")


def process_user_data(user_input: str):
    """
    ❌ Insecurely embeds PII directly into an LLM prompt.
    """
    prompt = (
        "You are a data-processing agent.\n"
        f"User SSN: {USER_SSN}\n"
        f"User Email: {USER_EMAIL}\n"
        f"Task: {user_input}"
    )
    # This call will expose PII in logs, network, and possibly model context:
    response = openai.ChatCompletion.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": prompt}],
    )
    return response


if __name__ == "__main__":
    user_task = input("Enter your data task: ")
    resp = process_user_data(user_task)
    print(resp.choices[0].message.content)
