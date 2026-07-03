# Backend

This folder contains the FastAPI backend for the productivity toolkit.

## Stack

- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Pydantic Settings
- python-jose
- passlib with bcrypt

## Responsibilities

The backend is responsible for:

- API routing
- JWT authentication
- Request and response validation
- Business logic for productivity modules
- Persistence through PostgreSQL
- Schema migrations through Alembic

## Folder Structure

```text
backend/
|-- app/
|   |-- api/
|   |-- core/
|   |-- db/
|   |-- models/
|   |-- schemas/
|   |-- services/
|   `-- main.py
|-- alembic/
|-- .env.example
|-- Dockerfile
|-- alembic.ini
`-- requirements.txt
```

## Backend Architecture

The backend follows a layered approach:

1. `api/` handles route registration and request entry points.
2. `schemas/` defines request and response contracts.
3. `services/` contains business logic.
4. `models/` defines database entities.
5. `db/` contains SQLAlchemy setup.
6. `core/` stores configuration and security helpers.

## Implemented Modules

- Auth
- Tasks
- Habits
- Focus sessions

## Initial Database Schema

The current initial migration creates:

- `users`
- `tasks`
- `subtasks`
- `habits`
- `habit_occurrences`
- `focus_sessions`
- `focus_session_items`

## Environment Variables

Use `backend/.env.example` as the base:

```env
DATABASE_URL=postgresql+psycopg://codephoenix:codephoenix@db:5432/codephoenix
SECRET_KEY=change-me-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

## Local Run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The backend runs at:

- API root: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Docker Run

From the repository root:

```bash
docker compose up --build
```

In Docker:

- The backend is mounted for live development
- Alembic runs automatically on startup
- PostgreSQL is provided by the `db` service

## API Overview

Current route groups:

- `GET /api/v1/health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/tasks`
- `GET /api/v1/habits`
- `GET /api/v1/focus-sessions`

## Frontend Integration Status

The active frontend in `Frontend/src/` is now wired to these API endpoints for:

- JWT auth and session restore
- Task CRUD
- Habit CRUD and completion tracking
- Focus session creation and lifecycle updates

## Testing

API tests live in `backend/tests/` and run against a real PostgreSQL database
using the project's Alembic migrations (strategy and roadmap in
[TESTING_PLAN.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/Documentation/TESTING_PLAN.md)).

One-time setup (with Docker running):

```bash
docker compose up -d db
docker compose exec db createdb -U codephoenix codephoenix_test
```

Run inside Docker (no local Python needed):

```bash
docker compose run --rm --no-deps \
  -e TEST_DATABASE_URL=postgresql+psycopg://codephoenix:codephoenix@db:5432/codephoenix_test \
  backend sh -c "pip install -q -r requirements-dev.txt && pytest"
```

Or locally with a venv (expects Postgres on `localhost:5432`):

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

The same suite runs in GitHub Actions on every push and pull request
(`.github/workflows/ci.yml`), including a standalone `alembic upgrade head`
step against an empty database.

## Related Documentation

- Root guide: [README.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/README.md)
- Architecture guide: [ARCHITECTURE.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/Documentation/ARCHITECTURE.md)
