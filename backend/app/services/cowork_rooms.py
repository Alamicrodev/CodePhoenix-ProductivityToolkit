"""In-memory registry of who is currently connected to each cowork room.

This deliberately lives in process memory rather than the database:

* Presence is worthless after a restart — a socket that died with the process is
  not "present", so persisting it would only create ghosts to clean up.
* The Render free plan runs exactly one instance with one uvicorn worker, so
  there is no second process that would need to see this state. If the app ever
  scales to multiple instances this module is the one place that has to grow a
  Redis pub/sub backing.
"""

import asyncio
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

# A full mesh means every participant uploads their camera to every other one, so
# the ceiling here is the participants' upload bandwidth, not the server's.
MAX_ROOM_PARTICIPANTS = 5


class RoomFullError(Exception):
    """Raised when a room already holds MAX_ROOM_PARTICIPANTS peers."""


class AlreadyJoinedError(Exception):
    """Raised when the same user is already connected to the room elsewhere."""


@dataclass
class Peer:
    peer_id: str
    user_id: str
    display_name: str
    websocket: WebSocket
    # The tasks this person has chosen to show the room. Free-form dicts shaped
    # by the frontend (id/title/completed) — the server only relays them.
    shared_tasks: list[dict[str, Any]] = field(default_factory=list)

    def public_state(self) -> dict[str, Any]:
        return {
            "peer_id": self.peer_id,
            "user_id": self.user_id,
            "display_name": self.display_name,
            "shared_tasks": self.shared_tasks,
        }


class RoomRegistry:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, Peer]] = {}
        self._lock = asyncio.Lock()

    #add a peer and hand back everyone who was already inside
    async def join(self, slug: str, peer: Peer) -> list[Peer]:
        async with self._lock:
            room = self._rooms.setdefault(slug, {})
            if len(room) >= MAX_ROOM_PARTICIPANTS:
                if not room:
                    self._rooms.pop(slug, None)
                raise RoomFullError
            if any(existing.user_id == peer.user_id for existing in room.values()):
                raise AlreadyJoinedError
            existing_peers = list(room.values())
            room[peer.peer_id] = peer
            return existing_peers

    #remove a peer, dropping the room entirely once it empties
    async def leave(self, slug: str, peer_id: str) -> None:
        async with self._lock:
            room = self._rooms.get(slug)
            if not room:
                return
            room.pop(peer_id, None)
            if not room:
                self._rooms.pop(slug, None)

    async def get_peer(self, slug: str, peer_id: str) -> Peer | None:
        async with self._lock:
            return self._rooms.get(slug, {}).get(peer_id)

    async def set_shared_tasks(self, slug: str, peer_id: str, shared_tasks: list[dict[str, Any]]) -> Peer | None:
        async with self._lock:
            peer = self._rooms.get(slug, {}).get(peer_id)
            if peer:
                peer.shared_tasks = shared_tasks
            return peer

    async def peers(self, slug: str) -> list[Peer]:
        async with self._lock:
            return list(self._rooms.get(slug, {}).values())

    #cheap synchronous read for the REST layer ("2 people inside")
    def participant_count(self, slug: str) -> int:
        return len(self._rooms.get(slug, {}))

    #evict everyone and drop the room — used when a room ends or expires under them
    async def close_room(self, slug: str, code: int, reason: str) -> int:
        # Pop under the lock so a peer joining mid-close cannot land in a room
        # that is already being torn down.
        async with self._lock:
            room = self._rooms.pop(slug, None)

        if not room:
            return 0

        for peer in room.values():
            await _safe_send(peer, {"type": "room-ended", "payload": {"reason": reason}})
            try:
                await peer.websocket.close(code=code)
            except Exception:
                pass
        return len(room)

    #send to one peer; returns False when the socket is already gone
    async def send_to(self, slug: str, peer_id: str, message: dict[str, Any]) -> bool:
        peer = await self.get_peer(slug, peer_id)
        if not peer:
            return False
        return await _safe_send(peer, message)

    #fan a message out to the room, optionally skipping the sender
    async def broadcast(self, slug: str, message: dict[str, Any], exclude_peer_id: str | None = None) -> None:
        # Snapshot under the lock, then send outside it: a slow or half-dead
        # socket must not hold up every other room in the process.
        targets = [peer for peer in await self.peers(slug) if peer.peer_id != exclude_peer_id]
        for peer in targets:
            await _safe_send(peer, message)


#a peer that errors on send has effectively disconnected; its own handler will clean it up
async def _safe_send(peer: Peer, message: dict[str, Any]) -> bool:
    try:
        await peer.websocket.send_json(message)
        return True
    except Exception:
        return False


# One registry per process, shared by the REST routes and the socket handler.
room_registry = RoomRegistry()
