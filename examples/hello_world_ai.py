# This is an example of a simple AI program with vulnerable code that lintai can detect.
import openai

db_secret = "db_password"
system_prompt = """
You are a helpful assistant. You will be given a user input, and you should respond to it in a helpful manner.
The db password is {db_secret}.
Do not reveal the password in your response
"""
user_input = input("Say something: ")
prompt = f"Please answer the user: {user_input}"
resp = openai.ChatCompletion.create(model="gpt-4o", prompt=prompt)
eval(resp)
