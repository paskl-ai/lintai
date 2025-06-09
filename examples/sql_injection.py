# examples/sql_injection.py
# ❌ SQL injection via naive string formatting
import sqlite3


def find_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    # If username = "foo' OR '1'='1", this returns all users!
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)
    return cursor.fetchall()


if __name__ == "__main__":
    uname = input("Username: ")
    print(find_user(uname))
