# examples/bad_exec.py
# ❌ Unsafe use of exec() on user input
def run_user_code(code):
    # This will execute any Python the user types!
    exec(code)

if __name__ == "__main__":
    user_code = input("Enter Python code to run: ")
    run_user_code(user_code)
