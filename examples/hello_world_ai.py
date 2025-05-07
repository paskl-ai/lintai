import openai
user_input = input("Say something: ")
prompt = f"Please answer the user: {user_input}"
resp = openai.ChatCompletion.create(model="gpt-4o", prompt=prompt)
eval(resp)
