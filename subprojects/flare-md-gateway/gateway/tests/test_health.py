import pytest
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
from fastapi.testclient import TestClient
import httpx
from gateway.app.main import app

@pytest.fixture(autouse=True)
def no_auth(monkeypatch):
    def noop(credentials):
        return None
    monkeypatch.setattr("gateway.app.main.require_auth", noop)

@pytest.fixture
def client(monkeypatch):
    return TestClient(app)

def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200

def test_readyz(monkeypatch, client):
    class FakeResp:
        status_code = 200
    async def fake_post(self, url, json):
        return FakeResp()
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post, raising=False)
    r = client.get("/readyz")
    assert r.status_code == 200

def test_health_deep(monkeypatch, client):
    async def fake_post_solver(payload):
        html = "<html><head><title>Time to Chill</title></head><body>Release 2022</body></html>"
        return {"status":"ok","solution":{"response":html}}
    monkeypatch.setattr("gateway.app.main._post_solver", fake_post_solver)
    r = client.post("/health/deep", auth=("toxic","Ann3xx!5G7e5Bmx"))
    assert r.status_code == 200
    assert r.json()["results"][0]["ok"]
