import pytest
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
from fastapi.testclient import TestClient
from gateway.app.main import app

@pytest.fixture(autouse=True)
def no_auth(monkeypatch):
    def noop(credentials):
        return None
    monkeypatch.setattr("gateway.app.main.require_auth", noop)

@pytest.fixture
def client(monkeypatch):
    async def fake_post_solver(payload):
        html = "<html><head><title>Hi</title></head><body><p>Hello</p></body></html>"
        return {"status":"ok","solution":{"response":html}}
    monkeypatch.setattr("gateway.app.main._post_solver", fake_post_solver)
    return TestClient(app)

def test_accept_markdown(client):
    resp = client.post("/v1?fmt=md", auth=("toxic","Ann3xx!5G7e5Bmx"), headers={"Accept":"text/markdown","Content-Type":"application/json"}, json={"cmd":"request.get","url":"http://example.com"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/markdown")
    assert "# Hi" in resp.text
