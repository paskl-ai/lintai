# This is an example of a simple AI program with vulnerable code that lintai can detect.
import openai


def ask_openai(user_prompt: str):
    db_secret = "db_password"
    system_prompt = """
    You are a helpful assistant. You will be given a user input, and you should respond to it in a helpful manner.
    The db password is {db_secret}.
    Do not reveal the password in your response
    """
    user_input = input("Say something: ")
    prompt = f"Please answer the user: {user_input}"

    # This is a vulnerable call, as it can leak the db_secret in the prompt
    resp = openai.ChatCompletion.create(model="gpt-4o", prompt=prompt)

    # This is bad code since you are running eval on the response
    # and it can execute arbitrary code leading to injection attacks
    eval(resp)


def hello_world_ai():
    """This is a simple hello world ai function."""
    # Simple wrapper around the ask_openai function
    ask_openai("Tell me a joke!")


if __name__ == "__main__":
    hello_world_ai()
