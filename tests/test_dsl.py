import json, subprocess, pathlib
ROOT = pathlib.Path(__file__).parents[1]

def test_dsl_rule_hits(tmp_path):
    # create a file with an f‑string containing "password"
    code = 'secret = "hunter2"\nprompt = f"My password is {secret}"\n'
    src = tmp_path / "leak.py"; src.write_text(code)
    # run lintai
    result = subprocess.run(["lintai", "scan", str(src), "--rules", str(ROOT/"dsl/rules")],
                            capture_output=True, text=True)
    findings = json.loads(result.stdout.strip().splitlines()[-1])
    assert any(f["owasp_id"] == "A02" for f in findings)
