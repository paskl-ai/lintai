from lintai.core.finding import Finding

def test_finding_to_dict():
    f = Finding(owasp_id="TEST", mitre=[], severity="info", message="ok")
    assert f.to_dict()["owasp_id"] == "TEST"
