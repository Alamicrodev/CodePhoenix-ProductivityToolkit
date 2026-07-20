# Cowork Sessions — Implementation Plan

> **Status (2026-07-20, branch `feat/cowork-sessions`):** Phases 1–3 implemented;
> Phase 4 partially done (cold-start UX, ICE config endpoint, TURN env wiring).
> Verified end to end in a browser: create room → share link → join → presence →
> bidirectional task sync → task write-through to the Tasks module → peer leave.
> **Not yet verified: two real webcams connecting.** The verification browser
> blocks camera access, so the WebRTC mesh has only been exercised through its
> signaling path. The manual NAT test matrix in Phase 3 is still outstanding and
> is the remaining risk. Remaining: WS ticket auth, guest access, Phase 5.

Shareable coworking rooms: a user creates a room, shares a link, and up to ~5 people
see each other's webcams and each other's "working on" task lists in real time.

**Architecture in one line:** video/audio is peer-to-peer WebRTC (never touches the
backend); the Render free-plan backend does only room CRUD, WebSocket signaling,
presence, and task-list broadcast; Supabase Postgres stores rooms.

```
Browser A ──────── video/audio (WebRTC mesh, P2P) ──────── Browser B
    │                                                         │
    └────── WSS /api/v1/ws/cowork/{slug} (signaling, ─────────┘
            presence, task sync, heartbeat)
                          │
            FastAPI on Render free (single instance,
            in-memory room registry — no Redis needed)
                          │
            Supabase Postgres (cowork_sessions table)
```

## Locked decisions (change these = change the plan)

| Decision | Choice | Rationale |
|---|---|---|
| Video topology | P2P mesh, DIY WebRTC | Render free can't relay media; mesh needs zero media infra |
| Room size cap | 5 participants (server-enforced) | Mesh upload cost is N−1 streams per client |
| Join auth | Existing account required (v1) | Reuses JWT auth; guest tokens are a v2 item |
| Scaling model | Exactly 1 uvicorn worker, in-memory rooms | Free plan is single-instance anyway; no pub/sub layer |
| Managed-video fallback | Decide at end of Phase 3 spike | If mesh reliability is unacceptable, swap to LiveKit Cloud/Daily free tier; Phases 1–2 survive unchanged |

## Phase 1 — Rooms: model, REST, pages (no realtime yet)

**Backend** (mirror the focus-sessions layering: model → schema → service → route):

- `app/models/cowork.py` — `CoworkSession`: `id` (str36 uuid, PK), `slug`
  (unique, indexed, `secrets.token_urlsafe(8)`), `host_user_id` (FK users, CASCADE),
  `title`, `status` (`open` | `ended`), `created_at`, `expires_at` (default now+24h),
  `ended_at`. Export in `app/models/__init__.py`. Add `cowork_sessions`
  relationship on `User`.
- `alembic/versions/20260720_000002_create_cowork_sessions.py` — runs automatically
  on deploy (`alembic upgrade head` is already in `render.yaml` startCommand).
- `app/schemas/cowork.py`, `app/services/cowork.py`, `app/api/routes/cowork.py`,
  registered in `app/api/router.py`:
  - `POST /cowork-sessions` → create, return slug
  - `GET /cowork-sessions/{slug}` → room info for the join page (404 if ended/expired)
  - `POST /cowork-sessions/{slug}/end` → host only
  - `GET /cowork-sessions` → rooms I host (for the lobby page)
- Service-level rules: looking up an expired/ended room 404s; ending an already-ended
  room is idempotent.

**Frontend:**

- Routes in `AppRoutes.tsx` under `AuthGuard`: `/cowork` (lobby: create room, copy
  link, list my rooms) and `/cowork/:slug` (the room). Nav item in `DashboardLayout`.
- **Prerequisite fix — deep links:** `AuthGuard.tsx` currently does
  `<Navigate to="/login" replace />` and drops the URL. A shared `/cowork/:slug` link
  opened by a logged-out user must survive login. Pass
  `state={{ from: location }}` (or `?returnTo=`) and have `LoginPage` redirect back
  after auth. Small, isolated, ship first.
- Keep all cowork state in a new `CoworkContext` (or `useCoworkRoom` hook).
  `DataContext.tsx` is already ~1,100 lines — do not add to it beyond exposing
  what exists (tasks list is already there).

**Done when:** two logged-in users can open the same `/cowork/:slug` URL and both see
the room page (static). Unit tests for slug lookup/expiry/host-only-end in
`backend/tests`.

## Phase 2 — WebSocket: presence + shared task lists

This phase is independently shippable: "see who's coworking and what they're
working on" is a real feature before any video exists.

**Backend:**

- `app/services/cowork_rooms.py` — in-memory `RoomRegistry`:
  `{slug: {peer_id: Peer(ws, user_id, display_name)}}` guarded by an `asyncio.Lock`,
  with `join / leave / broadcast / send_to` helpers. Enforce the 5-person cap and
  one-connection-per-user here.
- `app/api/routes/cowork_ws.py` — `WebSocket /api/v1/ws/cowork/{slug}`.
  - **Auth:** browsers can't set headers on WebSocket connects. v1: pass the JWT as
    `?token=` and validate with the existing `decode_access_token`. Hardening
    (Phase 4): `POST /cowork-sessions/{slug}/ws-ticket` issues a 30-second
    single-use ticket so long-lived JWTs stay out of URLs/access logs.
  - Reject: room not found/ended/expired (close code 4404), room full (4403),
    bad token (4401).
  - DB access inside the WS handler must be short-lived sessions per operation —
    never hold a Supabase pooler connection for the socket's lifetime.
- **Protocol** (JSON envelope `{type, from?, to?, payload}`), server-relayed:
  - Server→client: `welcome` (your peer_id + current roster + their task lists),
    `peer-joined`, `peer-left`, `task-list` (rebroadcast), `error`
  - Client→server: `task-list` (the tasks I've chosen to share, incl. completion
    flips), `ping` (server answers `pong`; server prunes sockets silent > 60s)
  - Reserved for Phase 3: `offer`, `answer`, `ice-candidate` (targeted relay via `to`)
- Constraint that makes this all work: **free plan = exactly one instance**, so the
  registry needs no Redis. Uvicorn must run with 1 worker (current `startCommand`
  already does).

**Frontend:**

- `src/lib/coworkProtocol.ts` — message types shared by hook + tests.
- `useCoworkRoom(slug)` — owns the socket: connect, heartbeat, **reconnect with
  exponential backoff + jitter** (Render restarts/deploys drop every socket; this is
  not an edge case, it's routine), roster state, task lists per peer.
- Room UI: participant tiles (initials avatar for now), per-peer task panel, and a
  "share what I'm working on" picker fed from the existing `tasks` in `DataContext`.
  Completing a task goes through the existing REST path; the hook then re-sends
  `task-list` so peers see it flip.

**Done when:** two browsers in one room see each other join/leave and see live task
lists; killing the backend mid-session reconnects and rebuilds the roster.
Tests: registry unit tests + `TestClient` websocket flow (join → broadcast → leave)
on the backend; protocol/reducer tests with a mocked socket in vitest.

## Phase 3 — WebRTC mesh video

The hard 80%. Budget more time than feels reasonable.

- **Signaling** rides the Phase 2 socket (`offer`/`answer`/`ice-candidate` with `to`).
- **Perfect negotiation** per peer pair; polite/impolite decided by `peer_id`
  comparison. New joiner initiates to each existing peer from the `welcome` roster.
- **Media budget:** `getUserMedia` at 640×360@15fps, then cap upload per sender to
  ~300 kbps via `RTCRtpSender.setParameters`. At 5 people that's ≤ ~1.2 Mbps up per
  client — the real reason for the cap.
- **ICE config from the backend:** add `GET /cowork-sessions/ice-config` returning
  STUN (Google public) + TURN URLs/credentials from env vars. Keeps TURN secrets out
  of the Vite bundle and lets you rotate/move providers without a frontend deploy.
- **TURN is not optional.** ~10–15% of peer pairs (symmetric NAT, corporate/campus
  networks) cannot connect P2P; without TURN they get silent black tiles. Set up a
  free tier (metered.ca Open Relay or Cloudflare TURN — verify current quotas when
  you get there) in this phase, not in polish.
- Frontend: `useWebRTCMesh(roomSocket)` hook, video grid tiles (local tile muted +
  mirrored), mic/camera toggle buttons, per-tile connection-state badge
  (connecting / connected / failed → auto ICE-restart).
- Resilience notes: P2P streams keep flowing while signaling is down; on socket
  reconnect, re-announce and only renegotiate failed pairs.
- **Test matrix (manual, non-negotiable):** two tabs on one machine → two machines
  on one LAN → two machines on different networks → one side on phone hotspot
  (the TURN case). Chrome + one other browser.

**Checkpoint:** if cross-network reliability is still poor after TURN, this is the
moment to swap Phase 3 for a managed layer (LiveKit/Daily free tier) — Phases 1–2
and the task-sync socket carry over unchanged.

## Phase 4 — Hardening + deploy

- WS ticket auth (replace `?token=`), rate-limit room creation, prune expired rooms
  lazily on lobby/join reads (no cron on the free plan).
- Host controls: end room (broadcasts `room-ended`, closes sockets).
- **Cold start UX:** free instance sleeps after ~15 min idle; first joiner can wait
  30–60 s. On the room page, ping `/api/v1/health` and show a "warming up the
  room…" state until it answers, then open the socket.
- Render/Vercel wiring: derive `wss://` from `VITE_API_BASE_URL` (https→wss) in
  `api.ts`; `CORS_ORIGINS` in `render.yaml` already lists the Vercel origin —
  WebSocket origin checks should use the same list.
- Signaling bandwidth is negligible against the 100 GB/month free allowance; the
  budget to actually watch is the TURN provider's relay quota.
- Docs: update `Documentation/ARCHITECTURE.md` (new realtime layer) and
  `backend/README.md` (TURN env vars).

## Phase 5 — Later / stretch

- Guest access via short-lived guest tokens (the reason it's not v1: touches auth).
- Text chat over the same socket (trivial once Phase 2 exists).
- **Shared focus session:** run a synchronized pomodoro inside the room, reusing the
  existing `FocusSession` machinery — natural product synergy.
- Screen share (just another track, but re-check the mesh bandwidth budget).
- Room history / "hours coworked together" stats.

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| P2P fails behind symmetric NAT | High | TURN in Phase 3, hotspot test case |
| Render deploy/restart drops all sockets | High (routine) | Reconnect+rebuild from day one (Phase 2) |
| Cold start confuses first joiner | Medium | Health-ping warm-up UX |
| Free TURN quota exhausted | Medium | Backend-served ICE config → swap providers without redeploying frontend; surface a "video degraded" notice |
| Mesh unusable > 5 people | Accepted | Hard cap server-side; SFU is a paid-infra decision later |
| JWT in WS query string | Low→fix | Ticket endpoint in Phase 4 |
| Pooler connection exhaustion from WS handlers | Medium | Short-lived DB sessions only; registry is memory-only |

## File-change map

| Area | Files |
|---|---|
| Backend new | `app/models/cowork.py`, `app/schemas/cowork.py`, `app/services/cowork.py`, `app/services/cowork_rooms.py`, `app/api/routes/cowork.py`, `app/api/routes/cowork_ws.py`, `alembic/versions/20260720_000002_*.py`, `tests/…` |
| Backend touched | `app/api/router.py`, `app/models/__init__.py`, `app/models/user.py`, `app/core/config.py` (TURN env), `render.yaml` (TURN env keys) |
| Frontend new | `pages/CoworkPage.tsx`, `pages/CoworkRoomPage.tsx`, `context/CoworkContext.tsx` (or `hooks/useCoworkRoom.ts`), `hooks/useWebRTCMesh.ts`, `lib/coworkProtocol.ts` + tests |
| Frontend touched | `routes/AppRoutes.tsx`, `routes/AuthGuard.tsx` (returnTo fix), `pages/LoginPage.tsx`, `components/DashboardLayout.tsx`, `lib/api.ts` (ws URL helper) |

## Suggested order & rough effort

1. AuthGuard returnTo fix — hours
2. Phase 1 (rooms + pages) — ~1 day
3. Phase 2 (socket, presence, tasks) — 2–3 days *(shippable milestone)*
4. Phase 3 (WebRTC + TURN + test matrix) — 1–2 weeks realistically
5. Phase 4 (hardening, deploy polish) — 2–3 days
