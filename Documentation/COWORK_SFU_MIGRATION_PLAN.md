# Cowork Video: Mesh → Cloudflare Realtime SFU

> **Status (2026-07-30): COMPLETE and verified against live Cloudflare.**
> Full path proven end to end: the aiortc fake publisher
> (`backend/scripts/sfu_fake_publisher.py`) published synthetic video through
> the proxy to Cloudflare, and a receive-only browser subscribed and rendered
> the frames. Two live-API corrections were needed, both now encoded in tests:
> `sessions/new` rejects an empty JSON body (`{}` fails validation — send no
> body), and a receive-only participant must bootstrap its session with a
> data-channel offer at creation, because Cloudflare 410s any operation on a
> session whose PeerConnection never connected. **Two-camera bidirectional
> video confirmed by a human on 2026-07-30** after fixing a startup race the
> test rig couldn't reproduce (welcome roster arriving before getUserMedia
> resolves — see commit 1094954). Remaining product work: WS ticket auth,
> rate limiting, guest access.

Replaces the P2P full mesh (unreliable across real-world networks) with
Cloudflare's SFU. Each participant opens **one** PeerConnection to Cloudflare's
anycast edge; Cloudflare routes tracks between them. The Render backend cannot
host media (no UDP ingress on any plan) and does not need to — it stays the
control plane and orchestrates Cloudflare's HTTPS API.

**What this buys:** the entire "black tile between networks" failure class goes
away (clients connect to Cloudflare edge, not to each other), upload cost stops
scaling with room size (1 stream up instead of N−1), the room cap can rise
5 → 12, and the most fragile client code (per-pair glare avoidance, ICE
restarts, candidate buffering) is deleted rather than maintained.

**What survives untouched:** rooms, slugs, lobby, deep-link auth, the WS
presence + task-list layer, `RoomRegistry`, eviction, TURN minting, video tiles,
and every Phase 1–2 test. The mesh was a consumer of the control plane; so is
the SFU client.

## Cloudflare API surface (verified against docs 2026-07-30)

Base `https://rtc.live.cloudflare.com/v1`, auth `Bearer <App Secret>`. The SFU
app (App ID + App Secret) is **separate from the TURN key** — created in the
dashboard under Realtime → SFU.

| Call | Purpose | SDP direction |
|---|---|---|
| `POST /apps/{appId}/sessions/new` | One per participant ≈ their PeerConnection | — |
| `POST /apps/{appId}/sessions/{sid}/tracks/new` (location `local`) | Publish camera/mic | client offers, CF answers |
| `POST /apps/{appId}/sessions/{sid}/tracks/new` (location `remote`) | Subscribe to another session's track | **CF offers**, client answers |
| `PUT /apps/{appId}/sessions/{sid}/renegotiate` | Complete a CF-initiated renegotiation | client answers |
| `PUT /apps/{appId}/sessions/{sid}/tracks/close` | Unpublish/unsubscribe | — |

Limits that shape the design: tracks are **garbage-collected after 30s without
media**; session operations require the PeerConnection `connected` (calls block
up to 5s); 50 API calls/s per session; **no rooms concept** — roster and
signaling are ours, which is exactly what the existing socket already does.

## Design decisions

1. **The backend proxies every Cloudflare API call.** The App Secret is
   server-side only, same principle as the TURN key. Browsers exchange SDP with
   our backend; only *media* flows browser ↔ Cloudflare.
2. **SDP exchange over REST, track announcements over the socket.** SDP flows
   are request/response — REST fits and keeps the WS protocol small. Which
   tracks exist is roster state — it rides the socket like task lists do, and
   lands in `welcome` for late joiners.
3. **One PeerConnection, serialized negotiation.** All publishes/subscribes go
   through a single async queue in the client hook. Two concurrent
   renegotiations on one PC corrupt signaling state; this queue is the most
   important line of the client design.
4. **Clean cut, no dual path.** The mesh has never shipped (branch is
   unmerged), so it is deleted, not feature-flagged. Rollback is git history.
5. **Receive-only carries over.** No camera → skip publishing, still subscribe.
   Same product behavior as today, structurally simpler (no recvonly
   transceiver dance).

## Protocol changes

`Peer` (backend registry) gains `sfu_session_id: str | None` and
`published_tracks: list[str]`, included in `public_state()` → `welcome`,
`peer-joined`.

- New client→server WS message: `media-published {session_id, track_names}` —
  broadcast to the room (mirrors `task-list` handling).
- Deleted: `offer` / `answer` / `ice-candidate` relay, `SIGNAL_TYPES`, and the
  whole client-side handling of them.

New REST endpoints (auth + caller must be a live peer in that room's registry —
prevents arbitrary users pumping media through our Cloudflare app):

- `POST /cowork-sessions/{slug}/sfu/session` → creates CF session, returns id
- `POST /cowork-sessions/{slug}/sfu/publish` `{session_id, offer, tracks}` → CF answer
- `POST /cowork-sessions/{slug}/sfu/subscribe` `{session_id, remote_session_id, track_names}` → CF offer
- `PUT  /cowork-sessions/{slug}/sfu/renegotiate` `{session_id, answer}` → ok
- `PUT  /cowork-sessions/{slug}/sfu/close-tracks` `{session_id, track_names}` → ok

## Phases

**Phase 0 — dashboard + env (user action, ~5 min).** Create the SFU app in
Cloudflare (Realtime → SFU), yielding `SFU_APP_ID` + `SFU_APP_SECRET`. Wire into
`config.py`, `backend/.env`, `render.yaml` (`sync: false`), README. Follows the
`turn.py` pattern exactly.

**Phase 1 — `app/services/sfu.py` + unit tests.** Thin client over the five
calls above, `httpx` with a 10s timeout (SDP calls are slower than TURN
minting), same fake-response test style as `test_turn_service.py`. Failure →
raise a typed error the routes turn into 502/503; *video* being down must not
break presence/tasks.

**Phase 2 — proxy routes + API tests.** The five endpoints, registry-membership
gating, tests for auth/membership/CF-failure paths (monkeypatched service).

**Phase 3 — socket changes + tests.** `media-published` handling, `Peer` state,
welcome roster carrying tracks, cleanup on leave. Mirror the existing
`task-list` tests.

**Phase 4 — `useSfuRoom` hook, replace the mesh.** One PC, negotiation queue,
publish-if-media / subscribe-always, subscribe on `media-published` and on
`welcome` roster, unsubscribe on `peer-left`, rebuild session on socket
reconnect (new peer identity ⇒ new CF session; the 30s track GC cleans up the
old one). `CoworkRoomPage` swaps hooks; tiles unchanged. `useWebRTCMesh.ts`
deleted.

**Phase 5 — verification, cap raise, docs.**
- **Fake publisher:** an `aiortc` script in the backend container joins a room,
  creates a CF session, and publishes a synthetic video track (color bars) —
  giving a *real* remote video tile to verify in the preview browser without a
  second camera. This is the SFU equivalent of `second_peer.py` and becomes a
  reusable QA tool.
- Manual: two browsers, then two networks. The forced-relay trick is obsolete —
  there is no P2P path left to accidentally test instead.
- Raise `MAX_ROOM_PARTICIPANTS` 5 → 12; grid gains an `xl` column.
- Update `ARCHITECTURE.md` (media plane diagram), `COWORK_SESSIONS_PLAN.md`
  status, this file's status line.

## Risks

| Risk | Mitigation |
|---|---|
| Concurrent renegotiation corrupts the PC | The serialized queue (decision 3); tested by hammering publish+subscribe together |
| 30s track GC bites during socket reconnects | Reconnect always builds a fresh session and re-announces; never resurrects old track names |
| CF `tracks/new` blocks up to 5s pre-connected | Create session → attach PC → wait `connected` → then publish; surface a "connecting video" tile state |
| CF API outage | Presence/tasks unaffected; banner "video temporarily unavailable"; typed 503 from proxy |
| Egress cost | Shared 1,000 GB free with TURN, then $0.05/GB; SFU egress ≈ (N−1) × bitrate × participants — the 300 kbps cap matters more now, keep it |
| App Secret leakage | Server-side only, proxied API, same scan-the-diff discipline as the TURN key |

## Estimate

Phases 1–3 ≈ a day (they mirror existing patterns). Phase 4 is the real work —
1–2 days, mostly the negotiation queue and reconnect lifecycle. Phase 5 ≈ half a
day. **Total ~3–4 days**, no NAT matrix required at the end of it.
