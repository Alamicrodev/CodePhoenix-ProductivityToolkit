# Backend

This folder contains the FastAPI backend scaffold for the productivity toolkit.

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
- Authentication scaffolding
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
- Dashboard summary

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
- `GET /api/v1/dashboard/summary`

## Next Integration Step

The backend scaffold is ready to replace the frontend prototype persistence layer. The next major step is wiring `Frontend/src/context/` to these API endpoints.

## Related Documentation

- Root guide: [README.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/README.md)
- Architecture guide: [ARCHITECTURE.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/Documentation/ARCHITECTURE.md)
