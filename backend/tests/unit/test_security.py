from datetime import timedelta

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)

settings = get_settings()


def test_password_hash_roundtrip():
    hashed = get_password_hash("password123")
    assert hashed != "password123"
    assert hashed.startswith("$2b$")
    assert verify_password("password123", hashed)


def test_wrong_password_fails_verification():
    hashed = get_password_hash("password123")
    assert not verify_password("different456", hashed)


def test_same_password_hashes_differently():
    # bcrypt salts every hash
    assert get_password_hash("password123") != get_password_hash("password123")


def test_token_roundtrip_returns_subject():
    token = create_access_token("user-42")
    assert decode_access_token(token) == "user-42"


def test_expired_token_rejected():
    token = create_access_token("user-42", expires_delta=timedelta(minutes=-5))
    with pytest.raises(HTTPException) as excinfo:
        decode_access_token(token)
    assert excinfo.value.status_code == 401


def test_token_signed_with_other_key_rejected():
    forged = jwt.encode({"sub": "user-42"}, "not-the-real-secret", algorithm="HS256")
    with pytest.raises(HTTPException) as excinfo:
        decode_access_token(forged)
    assert excinfo.value.status_code == 401


def test_token_without_subject_rejected():
    token = jwt.encode({"foo": "bar"}, settings.secret_key, algorithm="HS256")
    with pytest.raises(HTTPException) as excinfo:
        decode_access_token(token)
    assert excinfo.value.status_code == 401


def test_garbage_token_rejected():
    with pytest.raises(HTTPException) as excinfo:
        decode_access_token("not.a.token")
    assert excinfo.value.status_code == 401
