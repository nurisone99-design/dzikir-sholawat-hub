from fastapi.testclient import TestClient

import server


def test_health_returns_200_ok():
    client = TestClient(server.app)
    res = client.get("/health", headers={"host": "localhost"})
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_requires_no_auth():
    client = TestClient(server.app)
    res = client.get("/health", headers={"host": "localhost"})
    assert res.status_code == 200
    assert res.request.headers.get("Authorization") is None
