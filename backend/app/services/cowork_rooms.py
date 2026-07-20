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

    #add a peer and hand back everyone who was already inside, plus the peer this
    #join replaced (if any)
    async def join(self, slug: str, peer: Peer) -> tuple[list[Peer], Peer | None]:
        async with self._lock:
            room = self._rooms.setdefault(slug, {})
            # A connection from a user who is already registered is almost always
            # a reconnect racing its own zombie socket (the server only notices a
            # half-open socket after the idle timeout). Replace the old peer
            # rather than refusing — the caller closes the evicted socket, which
            # also handles the genuine two-tabs case by kicking the older tab.
            evicted = next(
                (existing for existing in room.values() if existing.user_id == peer.user_id),
                None,
            )
            if evicted:
                room.pop(evicted.peer_id, None)
            if len(room) >= MAX_ROOM_PARTICIPANTS:
                raise RoomFullError
            existing_peers = list(room.values())
            room[peer.peer_id] = peer
            return existing_peers, evicted

    #remove a peer, dropping the room entirely once it empties; returns False when
    #the peer was already gone (e.g. evicted by its own reconnect) so the caller
    #knows not to announce a departure that was already announced
    async def leave(self, slug: str, peer_id: str) -> bool:
        async with self._lock:
            room = self._rooms.get(slug)
            if not room or peer_id not in room:
                return False
            room.pop(peer_id)
            if not room:
                self._rooms.pop(slug, None)
            return True

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
