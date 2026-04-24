# CodePhoenix Productivity Toolkit

CodePhoenix Productivity Toolkit is a web-based productivity platform built as a final year project at BITS Pilani. The application combines task management, habit tracking, and focus session workflows in one system.

The repository currently contains:

- A React + Vite frontend in `Frontend/`
- A FastAPI + SQLAlchemy backend in `backend/`
- PostgreSQL for persistence
- Docker Compose for running the full stack locally
- Supporting project artifacts in `Documentation/`

See the partial implementation demo on YouTube: [Project Demo](https://www.youtube.com/watch?v=pZxzrRLDrf0)

## Architecture Summary

The system is organized as a small full-stack monorepo:

- `Frontend/`: React client, routing, UI components, context-based state management, and current mock/local persistence logic
- `backend/`: FastAPI API, JWT auth scaffold, SQLAlchemy models, Alembic migrations, and CRUD route modules
- `docker-compose.yml`: local orchestration for frontend, backend, and PostgreSQL
- `Documentation/`: architecture notes, diagrams, and project reports

High-level flow:

1. The user interacts with the React frontend.
2. The frontend renders pages for dashboard, tasks, habits, focus sessions, auth, and profile flows.
3. The backend exposes REST endpoints under `/api/v1`.
4. PostgreSQL stores users, tasks, subtasks, habits, habit occurrences, focus sessions, and focus session items.

Detailed documentation is available in [ARCHITECTURE.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/Documentation/ARCHITECTURE.md).

## Repository Structure

```text
CodePhoenix-ProductivityToolkit/
|-- Frontend/
|-- backend/
|-- Documentation/
|-- docker-compose.yml
|-- README.md
```

## Prerequisites

Choose one of the following workflows:

- Docker workflow:
  - Docker Desktop
  - Docker Compose
- Local workflow:
  - Node.js 20+
  - npm
  - Python 3.12+
  - PostgreSQL 16+

## Quick Start

Run the entire stack from the repository root:

```bash
docker compose up --build
```

Services start at:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

The backend container automatically runs Alembic migrations before starting the API.

## Local Development

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Backend Environment

Use `backend/.env.example` as the starting point for local configuration:

```env
DATABASE_URL=postgresql+psycopg://codephoenix:codephoenix@db:5432/codephoenix
SECRET_KEY=change-me-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

When running the backend outside Docker, update `DATABASE_URL` to point to your local PostgreSQL host if needed.

## Current Features

- User auth scaffold with register, login, and current-user endpoints
- Task management model and CRUD API scaffold
- Habit tracking model and CRUD API scaffold
- Focus session model and CRUD API scaffold
- Dashboard summary endpoint scaffold
- Frontend pages and UI for core productivity workflows

## API Overview

Current backend endpoints include:

- `GET /api/v1/health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/tasks`
- `GET /api/v1/habits`
- `GET /api/v1/focus-sessions`
- `GET /api/v1/dashboard/summary`

## Documentation

- Project architecture: [ARCHITECTURE.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/Documentation/ARCHITECTURE.md)
- Frontend guide: [Frontend/README.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/Frontend/README.md)
- Backend guide: [backend/README.md](file:///e:/_code/bits/CodePhoenix-ProductivityToolkit/backend/README.md)

## Notes

- The frontend still contains local state and localStorage-based behavior from the prototype implementation.
- The backend is scaffolded and ready for incremental frontend integration.
- There is duplicate legacy/stale code under `Frontend/src/app/`; the live app currently uses `Frontend/src/`.
