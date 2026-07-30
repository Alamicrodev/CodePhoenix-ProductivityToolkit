# CodePhoenix Productivity Toolkit Architecture

## Overview

This document describes the current architecture of the CodePhoenix Productivity Toolkit repository.

The project is implemented as a full-stack monorepo with three runtime components:

- `Frontend/`: React + Vite single-page application
- `backend/`: FastAPI REST API
- `db`: PostgreSQL database managed through Docker Compose

## System Context

At a high level, the platform works as follows:

1. Users access the React application in the browser.
2. The frontend handles routing, layouts, forms, and page rendering.
3. The frontend calls backend REST endpoints under `/api/v1`.
4. The FastAPI backend applies auth, validation, and business logic.
5. SQLAlchemy persists data in PostgreSQL.
6. Alembic manages schema migrations.

## Runtime Components

### Frontend

The frontend lives in `Frontend/` and is built with:

- React
- Vite
- TypeScript
- Tailwind CSS
- Radix UI and related component libraries

Current frontend responsibilities:

- Authentication screens
- Dashboard and feature pages
- Task, habit, and focus-session interactions
- Route protection
- Theme management
- Prototype/local persistence through React Context and localStorage

Important areas:

- `Frontend/src/App.tsx`: top-level application wiring
- `Frontend/src/routes/`: route definitions
- `Frontend/src/context/`: auth and productivity state
- `Frontend/src/components/`: reusable UI and feature components
- `Frontend/src/pages/`: page-level screens

### Backend

The backend lives in `backend/` and is built with:

- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Pydantic
- python-jose
- passlib with bcrypt

Backend responsibilities:

- API routing
- Request validation
- Authentication (JWT)
- Business logic for tasks, habits, and focus sessions
- Database persistence
- Migration management

Important areas:

- `backend/app/main.py`: FastAPI app entry point
- `backend/app/api/`: route wiring and dependencies
- `backend/app/models/`: SQLAlchemy models
- `backend/app/schemas/`: Pydantic request/response schemas
- `backend/app/services/`: service-layer logic
- `backend/app/core/`: settings and security helpers
- `backend/app/db/`: base model and DB session setup
- `backend/alembic/`: migration environment and versions

### Database

PostgreSQL is used as the primary relational datastore.

The current initial schema includes:

- `users`
- `tasks`
- `subtasks`
- `habits`
- `habit_occurrences`
- `focus_sessions`
- `focus_session_items`

These tables were designed to align with the current frontend data structures so the prototype can be migrated incrementally.

## Data Model

### User

Represents an authenticated application user.

Key fields:

- `id`
- `email`
- `full_name`
- `hashed_password`
- `created_at`
- `updated_at`

Relations:

- One user to many tasks
- One user to many habits
- One user to many focus sessions

### Task and Subtask

Tasks model user work items and support nested subtasks.

Task fields include:

- `title`
- `description`
- `completed`
- `completed_at`
- `priority`
- `due_date`
- `due_time`
- `quadrant`
- `tags`

Subtasks are stored separately and linked to tasks.

### Habit and HabitOccurrence

Habits model recurring activities.

Habit fields include:

- `title`
- `description`
- `frequency`
- `hourly_interval`
- `active_hours_start`
- `active_hours_end`
- `active_days`
- `streak`
- `last_completed`
- `completed_dates`

Habit occurrences are stored as separate records to support future analytics and history views.

### FocusSession and FocusSessionItem

Focus sessions model timer-driven work blocks.

Focus session fields include:

- `title`
- `total_duration_minutes`
- `focus_length_minutes`
- `break_length_minutes`
- `elapsed_seconds`
- `phase_type`
- `phase_remaining_seconds`
- `status`
- `completion_result`
- `completed`
- `completed_focus_blocks`
- `started_at`
- `paused_at`
- `ended_at`

Session items link the session to tasks or habits completed during the session.

### CoworkSession

Cowork sessions are shareable rooms: a host creates one, shares
`/cowork/{slug}`, and participants see each other's cameras and shared task
lists.

Fields: `slug` (unguessable share token), `host_user_id`, `title`, `status`
(`open` | `ended`), `expires_at` (24h default), `ended_at`.

Only the room is persisted. Two things deliberately are not:

- **Presence** lives in an in-memory registry (`app/services/cowork_rooms.py`).
  A socket that died with the process is not "present", so persisting it would
  only create ghosts. The free plan runs a single instance with one worker, so
  no second process needs to see this state — that module is the one place that
  would grow a Redis backing if the app ever scaled horizontally.
- **Audio and video** never reach the backend. Each participant holds one
  WebRTC PeerConnection to Cloudflare's Realtime SFU (anycast edge), which
  routes tracks between them. The backend proxies Cloudflare's Sessions/Tracks
  HTTPS API (`app/api/routes/cowork_sfu.py`, gated on live room membership) so
  the App Secret stays server-side. Rooms are capped at twelve — with an SFU
  the constraint is download bandwidth and UI density, not upload.

## Realtime Layer

`WS /api/v1/ws/cowork/{slug}` carries three things: presence, shared task lists,
and `media-published` announcements (which Cloudflare SFU session/tracks each
peer publishes, server-stamped so peers cannot impersonate each other). The SDP
handshake itself goes over the REST proxy, not the socket.

Operational notes:

- The JWT arrives as a query parameter because browsers cannot set headers on a
  WebSocket handshake. A short-lived single-use ticket endpoint is the planned
  hardening.
- The handler releases its database connection immediately after the join
  handshake rather than pinning one for the socket's lifetime, which matters
  against a Supabase pooler.
- A free instance drops every socket it holds on deploy and on wake-from-idle,
  so client reconnection with jittered backoff is normal operation, not an edge
  case. Peer-to-peer video keeps flowing while signaling is down.
- ICE servers are served by `GET /cowork-sessions/ice-config` so TURN
  credentials stay out of the frontend bundle and the provider can be swapped
  without a frontend deploy. TURN is Cloudflare Realtime, which issues
  short-lived credentials rather than a fixed username/password: the backend
  holds the long-term key and mints one per request. If Cloudflare is
  unreachable the endpoint degrades to STUN-only and flags `has_turn: false`
  rather than failing the room.

## API Design

The backend exposes REST endpoints under `/api/v1`.

Current route groups:

- `/health`
- `/auth`
- `/tasks`
- `/habits`
- `/focus-sessions`

The backend currently uses JWT bearer tokens for protected routes.

## Application Flow

### Authentication Flow

1. User registers through `/api/v1/auth/register`.
2. User logs in through `/api/v1/auth/login`.
3. Backend returns a bearer token.
4. Frontend sends the token on protected requests.
5. Backend resolves the current user from the token.

### Productivity Data Flow

Current state:

- The frontend manages task, habit, and focus-session state through the backend API.
- The backend provides the matching server-side models, services, and routes.

Target state:

1. Frontend creates or updates entities through the backend API.
2. Backend validates and persists changes in PostgreSQL.
3. Frontend fetches the latest state from the backend.

## Container Architecture

The local Docker stack is defined in `docker-compose.yml`.

Services:

- `frontend`
- `backend`
- `db`

### Frontend Container

- Builds from `Frontend/Dockerfile`
- Runs Vite dev server on port `5173`
- Mounts the frontend directory for live development

### Backend Container

- Builds from `backend/Dockerfile`
- Runs `alembic upgrade head` before starting Uvicorn
- Exposes the API on port `8000`
- Mounts the backend directory for live development

### Database Container

- Uses `postgres:16-alpine`
- Exposes PostgreSQL on port `5432`
- Persists data through a Docker volume

## Development Architecture Notes

### Frontend Code Layout

The application lives under `Frontend/src/`, with the entry chain `index.html` → `src/main.tsx` → `src/App.tsx` → `src/routes/AppRoutes.tsx` plus providers in `src/context/`. (A duplicated legacy `src/app/` mock tree has been removed from the repository.)

### Service Layer Pattern

The backend uses a layered structure:

1. Routes receive HTTP requests.
2. Schemas validate request and response data.
3. Services implement business logic.
4. Models define persistence.
5. DB session utilities manage SQLAlchemy sessions.

This keeps route handlers thin and makes the backend easier to extend.

## Security Notes

Current backend security includes:

- Password hashing with bcrypt via passlib
- JWT token generation and decoding
- Protected route dependency for current user resolution

Current limitations:

- Default development secrets are not production-safe
- Role-based access control is not implemented
- Refresh tokens are not implemented
- Email verification and password reset are not implemented

## Recommended Next Steps

- Replace frontend localStorage persistence with backend API integration
- Add tests for auth and CRUD flows
- Add role or permissions support if needed
- Add environment-specific configuration for production deployment
- Expand dashboard analytics using persisted habit and focus-session data
