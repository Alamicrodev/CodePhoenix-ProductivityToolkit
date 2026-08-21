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
- AI scheduler
- Cowork sessions, realtime presence, and SFU video proxy

## Initial Database Schema

The current migrations create:

- `users`
- `tasks`
- `subtasks`
- `habits`
- `habit_occurrences`
- `focus_sessions`
- `focus_session_items`
- `cowork_sessions`

The latest task schema also stores `duration_minutes`, used by the schedule timeline.

## Environment Variables

Use `backend/.env.example` as the base:

```env
DATABASE_URL=postgresql+psycopg://codephoenix:codephoenix@db:5432/codephoenix
SECRET_KEY=change-me-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

Optional, for AI schedule suggestions:

```env
GEMINI_API_KEY=<gemini api key>
SCHEDULER_MODEL=gemini-3.5-flash
SCHEDULER_MODEL_TIMEOUT_SECONDS=60
```

When `GEMINI_API_KEY` is absent, `POST /ai-scheduler/suggest` returns a deterministic heuristic plan so local development and tests do not require an external AI key.

Optional, for cowork room video. Create a TURN Server app under **Realtime → TURN
Server** in the Cloudflare dashboard, which yields a Turn Token ID and an API
token:

```env
TURN_KEY_ID=<turn token id>
TURN_KEY_API_TOKEN=<api token>
TURN_CREDENTIAL_TTL_SECONDS=21600   # optional, default 6h, Cloudflare max 48h
STUN_URLS=["stun:stun.l.google.com:19302"]   # optional fallback when TURN is off
```

Cloudflare does not issue a fixed username/password. The API token is a long-term
secret held **server-side only**; `GET /cowork-sessions/ice-config` exchanges it
for a short-lived credential per request, which is why the frontend asks the
backend for ICE servers instead of holding anything itself.

If the key is absent or Cloudflare is unreachable, the endpoint degrades to
STUN-only and reports `has_turn: false`; the room still works and the UI warns
that video may not connect on restrictive networks. Set the TTL longer than the
longest session you expect — a credential expiring mid-call drops the relay.

Cowork video routes through the Cloudflare Realtime **SFU** (each participant
holds one PeerConnection to Cloudflare's edge; the backend proxies the
Sessions/Tracks API so the App Secret never reaches a browser). Create an SFU
app under **Realtime → SFU** — it is separate from the TURN key:

```env
SFU_APP_ID=<app id>
SFU_APP_SECRET=<app secret>
```

Without these (or when Cloudflare is unreachable) rooms degrade to
presence-and-tasks-only and the UI says video is unavailable.

Billing note: 1,000 GB of egress is included (shared across TURN and SFU), then
$0.05/GB. SFU egress ≈ (participants − 1) × bitrate × participants — the client
caps video at 300 kbps to keep this bounded.

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
- `/api/v1/auth`: register, login, current user
- `/api/v1/tasks`: task CRUD
- `/api/v1/habits`: habit CRUD, complete, undo
- `/api/v1/focus-sessions`: focus session CRUD, lifecycle actions, item completion
- `/api/v1/ai-scheduler/suggest`: AI or heuristic schedule suggestions
- `/api/v1/cowork-sessions`: room CRUD, ICE configuration, room ending
- `WS /api/v1/ws/cowork/{slug}`: cowork presence, shared task lists, and media-published events
- `/api/v1/cowork-sessions/{slug}/sfu`: Cloudflare Realtime SFU session and track proxy

## Frontend Integration Status

The active frontend in `Frontend/src/` is now wired to these API endpoints for:

- JWT auth and session restore
- Task CRUD
- Habit CRUD and completion tracking
- Focus session creation and lifecycle updates
- Cowork room creation, joining, presence, shared task lists, and SFU-backed video when configured

The schedule page is computed in the frontend from persisted tasks and habits. The backend AI scheduler endpoint is available for schedule suggestions, with a Gemini implementation and a heuristic fallback.

## Using a hosted Supabase database

The backend is database-agnostic over `DATABASE_URL`; point it at a Supabase
Postgres instead of the local Docker `db` service by overriding that one var.

Important: use Supabase's **session pooler** connection (IPv4, port 5432), not
the direct `db.<ref>.supabase.co` host — the direct endpoint is IPv6-only and
will not resolve on most local/hosting networks. In the Supabase dashboard:
**Connect → Connection string → Session pooler**. Convert the scheme to
`postgresql+psycopg` and append `?sslmode=require`:

```
postgresql+psycopg://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Run the migrations against it (from the repo root):

```bash
export SUPABASE_URL='postgresql+psycopg://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
docker compose run --rm --no-deps -e DATABASE_URL="$SUPABASE_URL" backend alembic upgrade head
```

Run the API against it (publishes port 8000):

```bash
docker compose run --rm --no-deps --service-ports -e DATABASE_URL="$SUPABASE_URL" \
  backend uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For local convenience you can instead put the Supabase `DATABASE_URL` in a
gitignored `backend/.env` (see `.env.example`) and run the backend outside
Docker. For a deployed backend, set `DATABASE_URL` in the host's environment
variables rather than committing it. Plain `docker compose up` still uses the
local Docker Postgres.

## Testing

API tests live in `backend/tests/` and run against a real PostgreSQL database
using the project's Alembic migrations (strategy and roadmap in
[../Documentation/TESTING_PLAN.md](../Documentation/TESTING_PLAN.md)).

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

- Root guide: [../README.md](../README.md)
- Architecture guide: [../Documentation/ARCHITECTURE.md](../Documentation/ARCHITECTURE.md)
