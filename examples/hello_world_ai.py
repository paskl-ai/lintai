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


def test_dsl_rule_hits(tmp_path):
    code = 'secret = "hunter2"\nprompt = f"My password is {secret}"\n'
    src = tmp_path / "leak.py"
    src.write_text(code)

    result = subprocess.run(
        ["lintai", "scan", str(tmp_path), "--ruleset", str(ROOT / "lintai/dsl/rules")],
        env=dict(os.environ, LINTAI_LLM_PROVIDER="dummy"),
        capture_output=True,
        text=True,
    )
