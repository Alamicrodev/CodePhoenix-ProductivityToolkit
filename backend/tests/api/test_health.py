from tests.factories import API


def test_health_returns_ok(client):
    response = client.get(f"{API}/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "backend"}
