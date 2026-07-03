import pytest

from tests.factories import API, DEFAULT_PASSWORD

REGISTER = {"email": "new@example.com", "password": DEFAULT_PASSWORD, "full_name": "New User"}


def test_register_returns_created_user(client):
    response = client.post(f"{API}/auth/register", json=REGISTER)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["full_name"] == "New User"
    assert body["id"]
    assert body["created_at"]
    # the response must never leak credential material
    assert "password" not in body
    assert "hashed_password" not in body


def test_register_duplicate_email_rejected(client):
    assert client.post(f"{API}/auth/register", json=REGISTER).status_code == 201
    response = client.post(f"{API}/auth/register", json=REGISTER)
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_register_short_password_rejected(client):
    response = client.post(f"{API}/auth/register", json={**REGISTER, "password": "short"})
    assert response.status_code == 422


def test_register_invalid_email_rejected(client):
    response = client.post(f"{API}/auth/register", json={**REGISTER, "email": "not-an-email"})
    assert response.status_code == 422


def test_register_stores_email_lowercased_and_name_stripped(client):
    response = client.post(
        f"{API}/auth/register",
        json={"email": "MiXeD@Example.COM", "password": DEFAULT_PASSWORD, "full_name": "  Padded  "},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "mixed@example.com"
    assert body["full_name"] == "Padded"


def test_login_returns_bearer_token(client):
    client.post(f"{API}/auth/register", json=REGISTER)
    response = client.post(
        f"{API}/auth/login", json={"email": REGISTER["email"], "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_login_is_case_insensitive_on_email(client):
    client.post(f"{API}/auth/register", json=REGISTER)
    response = client.post(
        f"{API}/auth/login", json={"email": "NEW@EXAMPLE.COM", "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


def test_login_wrong_password_rejected(client):
    client.post(f"{API}/auth/register", json=REGISTER)
    response = client.post(
        f"{API}/auth/login", json={"email": REGISTER["email"], "password": "wrongpassword1"}
    )
    assert response.status_code == 401


def test_login_unknown_email_rejected(client):
    response = client.post(
        f"{API}/auth/login", json={"email": "ghost@example.com", "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    response = client.get(f"{API}/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_me_without_token_rejected(client):
    assert client.get(f"{API}/auth/me").status_code == 401


def test_me_with_garbage_token_rejected(client):
    response = client.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


def test_long_password_roundtrip(client):
    """Passwords near the 128-char schema max hash and verify correctly.

    Regression guard for the passlib/bcrypt incompatibility that once made
    every registration fail with a 500 (bcrypt handles truncation at 72
    bytes; hashing must not raise).
    """
    password = "x" * 100
    response = client.post(
        f"{API}/auth/register",
        json={"email": "long@example.com", "password": password, "full_name": "Long"},
    )
    assert response.status_code == 201, response.text
    response = client.post(
        f"{API}/auth/login", json={"email": "long@example.com", "password": password}
    )
    assert response.status_code == 200


PROTECTED_ROUTES = [
    ("GET", "/auth/me"),
    ("GET", "/tasks"),
    ("POST", "/tasks"),
    ("GET", "/tasks/x"),
    ("PATCH", "/tasks/x"),
    ("DELETE", "/tasks/x"),
    ("GET", "/habits"),
    ("POST", "/habits"),
    ("GET", "/habits/x"),
    ("PATCH", "/habits/x"),
    ("POST", "/habits/x/complete"),
    ("POST", "/habits/x/undo"),
    ("DELETE", "/habits/x"),
    ("GET", "/focus-sessions"),
    ("POST", "/focus-sessions"),
    ("GET", "/focus-sessions/x"),
    ("PATCH", "/focus-sessions/x"),
    ("POST", "/focus-sessions/x/pause"),
    ("POST", "/focus-sessions/x/items/y/complete"),
    ("DELETE", "/focus-sessions/x"),
    ("GET", "/dashboard/summary"),
]


@pytest.mark.parametrize("method,path", PROTECTED_ROUTES)
def test_protected_routes_require_token(client, method, path):
    response = client.request(method, f"{API}{path}")
    assert response.status_code == 401
