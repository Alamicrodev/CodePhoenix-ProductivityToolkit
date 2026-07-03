"""Shared fixtures for the backend test suite.

The suite runs against a real PostgreSQL database so tests exercise the same
dialect as production. The schema is built by running the actual Alembic
migrations, so every test run doubles as a migration regression test
(see Documentation/TESTING_PLAN.md).

Point TEST_DATABASE_URL at a dedicated, disposable database, e.g.:

    docker compose up -d db
    docker compose exec db createdb -U codephoenix codephoenix_test
    pytest
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://codephoenix:codephoenix@localhost:5432/codephoenix_test",
)
# Must be exported before any app import: settings are cached at import time
# and app.db.session builds its engine from DATABASE_URL when imported.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app import models  # noqa: E402,F401  (populates Base.metadata)
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from tests.factories import API, DEFAULT_PASSWORD  # noqa: E402

engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def apply_migrations():
    """Rebuild the schema from scratch through the real Alembic migrations."""
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")
    yield


@pytest.fixture()
def db():
    """Session bound to an outer transaction that is always rolled back.

    join_transaction_mode="create_savepoint" turns the service layer's
    ``db.commit()`` calls into savepoint releases, so each test observes its
    own writes but leaves the database untouched for the next test.
    """
    connection = engine.connect()
    outer = connection.begin()
    session = TestingSession(bind=connection, join_transaction_mode="create_savepoint")
    app.dependency_overrides[get_db] = lambda: session
    try:
        yield session
    finally:
        app.dependency_overrides.pop(get_db, None)
        session.close()
        outer.rollback()
        connection.close()


@pytest.fixture()
def client(db):
    return TestClient(app)


def register_and_login(client, email="user@example.com", full_name="Test User"):
    response = client.post(
        f"{API}/auth/register",
        json={"email": email, "password": DEFAULT_PASSWORD, "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    response = client.post(
        f"{API}/auth/login",
        json={"email": email, "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def auth_headers(client):
    return register_and_login(client)


@pytest.fixture()
def other_auth_headers(client):
    return register_and_login(client, email="other@example.com", full_name="Other User")
