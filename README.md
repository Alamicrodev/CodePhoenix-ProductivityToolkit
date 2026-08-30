# CodePhoenix Productivity Toolkit

CodePhoenix Productivity Toolkit is a web-based productivity platform built as a final year project at BITS Pilani. The application combines scheduling, task management, habit tracking, focus sessions, AI schedule suggestions, and coworking rooms in one system.

The repository currently contains:

- A React + Vite frontend in `Frontend/`
- A FastAPI + SQLAlchemy backend in `backend/`
- PostgreSQL for persistence
- Docker Compose for running the full stack locally
- Render and Vercel deployment configuration
- Supporting project artifacts in `Documentation/`

Watch the project demo on YouTube: [Project Demo](https://www.youtube.com/watch?v=TZcZFXkjK5s&t=57s)

## Architecture Summary

The system is organized as a small full-stack monorepo:

- `Frontend/`: React client, routing, UI components, and context-based state management backed by the REST API and cowork WebSocket
- `backend/`: FastAPI API, JWT auth, SQLAlchemy models, Alembic migrations, REST routes, cowork WebSocket, and Cloudflare Realtime proxy routes
- `docker-compose.yml`: local orchestration for frontend, backend, and PostgreSQL
- `Documentation/`: architecture notes, diagrams, and project reports

High-level flow:

1. The user interacts with the React frontend.
2. The frontend renders pages for schedule, tasks, habits, focus sessions, cowork, auth, and profile flows.
3. The backend exposes REST endpoints under `/api/v1`.
4. PostgreSQL stores users, tasks, subtasks, habits, habit occurrences, focus sessions, focus session items, and cowork rooms.
5. Cowork rooms use a WebSocket for presence/task-list updates and Cloudflare Realtime SFU for video when SFU credentials are configured.

Detailed documentation is available in [Documentation/ARCHITECTURE.md](Documentation/ARCHITECTURE.md).

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

- User auth with register, login, and current-user endpoints (JWT)
- Backend-backed task management with subtasks, tags, and priorities
- Backend-backed habit tracking with streaks and completion history
- Schedule home page with agenda/timeline views, drag-and-drop scheduling, task estimates, and habit schedule windows
- Backend-backed focus session flows with pomodoro-style phases
- Cowork rooms with share links, live presence, shared task lists, and optional Cloudflare SFU video
- Backend AI scheduler endpoint with Gemini support and a heuristic fallback when no API key is configured
- Automated test suite (pytest, Vitest, Playwright) with GitHub Actions CI

## API Overview

Current backend route groups include:

- `GET /api/v1/health`
- `/api/v1/auth`: register, login, and current-user lookup
- `/api/v1/tasks`: task CRUD with subtasks, tags, priorities, due dates, and duration estimates
- `/api/v1/habits`: habit CRUD, completion, undo, streaks, and occurrence history
- `/api/v1/focus-sessions`: session CRUD, lifecycle actions, and item completion
- `/api/v1/ai-scheduler/suggest`: AI or heuristic schedule suggestions from current workspace data
- `/api/v1/cowork-sessions`: cowork room CRUD, ICE config, and host room ending
- `WS /api/v1/ws/cowork/{slug}`: cowork presence, shared task lists, and media-published announcements
- `/api/v1/cowork-sessions/{slug}/sfu`: server-side proxy for Cloudflare Realtime SFU session and track operations

## Documentation

- Project architecture: [Documentation/ARCHITECTURE.md](Documentation/ARCHITECTURE.md)
- Frontend guide: [Frontend/README.md](Frontend/README.md)
- Backend guide: [backend/README.md](backend/README.md)

## Notes

- The active app under `Frontend/src/` is integrated with the FastAPI backend; schedule views are derived from persisted tasks and habits.
- JWT session restore still uses localStorage to persist the access token in the browser.
- Cowork video degrades to presence-and-tasks-only when Cloudflare SFU credentials are not configured.
