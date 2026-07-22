"""WebSocket endpoint backing a cowork room.

Carries three things: presence (who is here), the task lists people choose to
share, and the WebRTC handshake messages peers use to find each other. The
webcam audio/video itself never passes through here — once signaling succeeds
the browsers talk directly, which is the only reason this fits on a free plan.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.services.cowork import get_joinable_cowork_session_or_404
from app.services.cowork_rooms import (
    MAX_ROOM_PARTICIPANTS,
    Peer,
    RoomFullError,
    room_registry,
)

router = APIRouter(tags=["cowork-ws"])

# Application close codes (4000-4999 is the range reserved for app use).
WS_UNAUTHORIZED = 4401
WS_ROOM_FULL = 4403
WS_ROOM_NOT_FOUND = 4404
WS_ALREADY_JOINED = 4409
# Reuses 4404: from the client's point of view "the host ended it" and "it
# expired" both mean the room is gone, and the UI copy already says so.
WS_ROOM_ENDED = 4404

# The client pings every 30s; three missed pings and we assume the socket is a
# half-open zombie (common when a laptop sleeps or a phone changes network).
IDLE_TIMEOUT_SECONDS = 95
MAX_SHARED_TASKS = 50

# Messages a peer may ask us to relay verbatim to one other peer.
SIGNAL_TYPES = {"offer", "answer", "ice-candidate"}


class SharedTask(BaseModel):
    id: str
    title: str = Field(max_length=255)
    completed: bool = False


class IncomingMessage(BaseModel):
    type: str
    to: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


@router.websocket("/ws/cowork/{slug}")
async def cowork_socket(
    websocket: WebSocket,
    slug: str,
    token: str = Query(..., description="JWT access token"),
    db: Session = Depends(get_db),
):
    # Accept before any of the checks below: closing a socket that was never
    # accepted rejects the handshake at the HTTP layer (403), which browsers
    # surface as an opaque 1006 — the client could then never tell "sign in
    # again" or "room is gone" apart from a transient drop, and would retry a
    # rejection forever.
    await websocket.accept()

    # Browsers cannot set headers on a WebSocket handshake, so the JWT arrives as
    # a query param. Phase 4 replaces this with a short-lived single-use ticket so
    # long-lived tokens stay out of URLs and proxy access logs.
    try:
        user_id = decode_access_token(token)
    except Exception:
        await websocket.close(code=WS_UNAUTHORIZED)
        return

    user = db.get(User, user_id)
    if not user:
        await websocket.close(code=WS_UNAUTHORIZED)
        return

    # Only a genuine missing/ended room may read as "not found" — anything else
    # (say, a database hiccup) must stay a transient error the client retries,
    # not a fatal "this room has ended".
    try:
        cowork_session = get_joinable_cowork_session_or_404(db, slug)
    except HTTPException:
        await websocket.close(code=WS_ROOM_NOT_FOUND)
        return

    # Everything the socket needs is now plain Python values. Release the database
    # connection instead of pinning one for the whole (potentially hours-long)
    # call — the Supabase pooler has a small connection budget on the free tier.
    room_title = cowork_session.title
    host_user_id = cowork_session.host_user_id
    # Held locally so the expiry check below costs nothing — re-querying per
    # heartbeat would mean a database round trip every 30s per participant.
    expires_at = cowork_session.expires_at
    display_name = user.full_name
    db.close()

    peer = Peer(
        peer_id=str(uuid.uuid4()),
        user_id=user_id,
        display_name=display_name,
        websocket=websocket,
    )

    try:
        existing_peers, evicted = await room_registry.join(slug, peer)
    except RoomFullError:
        await websocket.close(code=WS_ROOM_FULL)
        return

    if evicted:
        # Usually our own zombie socket left over from a network change; closing
        # it is a formality. If it is a live second tab, that tab gets told it
        # was replaced (4409 is fatal client-side, so it will not reconnect and
        # start an eviction ping-pong).
        try:
            await evicted.websocket.close(code=WS_ALREADY_JOINED)
        except Exception:
            pass
        await room_registry.broadcast(
            slug,
            {"type": "peer-left", "payload": {"peer_id": evicted.peer_id}},
            exclude_peer_id=peer.peer_id,
        )

    # The joiner gets the full roster so it can open a peer connection to each
    # person already inside; existing peers only need to hear about the new one.
    await websocket.send_json(
        {
            "type": "welcome",
            "payload": {
                "peer_id": peer.peer_id,
                "room": {"slug": slug, "title": room_title, "host_user_id": host_user_id},
                "max_participants": MAX_ROOM_PARTICIPANTS,
                "peers": [existing.public_state() for existing in existing_peers],
            },
        }
    )
    await room_registry.broadcast(
        slug,
        {"type": "peer-joined", "payload": peer.public_state()},
        exclude_peer_id=peer.peer_id,
    )

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_json(), timeout=IDLE_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                break

            # A room can lapse while people are still inside it. Clients ping
            # every 30s, so checking on inbound traffic evicts them promptly
            # without a timer or a database hit.
            if datetime.now(timezone.utc) >= expires_at:
                await room_registry.close_room(slug, WS_ROOM_ENDED, "expired")
                break

            await _handle_message(slug, peer, raw)
    except WebSocketDisconnect:
        pass
    except Exception:
        # A malformed frame or a socket dying mid-send should take down this one
        # connection, never the room.
        pass
    finally:
        # leave() reports False when this peer was already removed — evicted by
        # its own reconnect, or swept out by close_room — in which case the room
        # has already heard about the departure (or no longer exists).
        if await room_registry.leave(slug, peer.peer_id):
            await room_registry.broadcast(slug, {"type": "peer-left", "payload": {"peer_id": peer.peer_id}})


#route one inbound frame; unknown types are ignored rather than fatal
async def _handle_message(slug: str, peer: Peer, raw: Any) -> None:
    try:
        message = IncomingMessage.model_validate(raw)
    except ValidationError:
        await _send_error(peer, "Malformed message")
        return

    if message.type == "ping":
        await peer.websocket.send_json({"type": "pong"})
        return

    if message.type == "task-list":
        await _handle_task_list(slug, peer, message)
        return

    if message.type in SIGNAL_TYPES:
        await _relay_signal(slug, peer, message)
        return


#replace this peer's shared task list and tell the room
async def _handle_task_list(slug: str, peer: Peer, message: IncomingMessage) -> None:
    try:
        tasks = [SharedTask.model_validate(entry) for entry in message.payload.get("tasks", [])[:MAX_SHARED_TASKS]]
    except (ValidationError, TypeError):
        await _send_error(peer, "Malformed task list")
        return

    serialized = [task.model_dump() for task in tasks]
    await room_registry.set_shared_tasks(slug, peer.peer_id, serialized)
    await room_registry.broadcast(
        slug,
        {"type": "task-list", "from": peer.peer_id, "payload": {"tasks": serialized}},
    )


#pass an SDP offer/answer or ICE candidate to exactly one other peer in the room
async def _relay_signal(slug: str, peer: Peer, message: IncomingMessage) -> None:
    if not message.to:
        await _send_error(peer, "Signal messages require a target peer")
        return

    # `from` is stamped server-side: a peer must not be able to impersonate another.
    delivered = await room_registry.send_to(
        slug,
        message.to,
        {"type": message.type, "from": peer.peer_id, "payload": message.payload},
    )
    if not delivered:
        await _send_error(peer, "Peer is no longer in this room")


async def _send_error(peer: Peer, detail: str) -> None:
    try:
        await peer.websocket.send_json({"type": "error", "payload": {"message": detail}})
    except Exception:
        pass
