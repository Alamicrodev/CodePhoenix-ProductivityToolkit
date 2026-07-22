from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CoworkSessionStatus = Literal["open", "ended"]


class CoworkSessionCreate(BaseModel):
    # Optional: the frontend can let the host name the room, otherwise we default it.
    title: str | None = Field(default=None, min_length=1, max_length=255)


class CoworkSessionResponse(BaseModel):
    id: str
    slug: str
    title: str
    status: CoworkSessionStatus
    host_user_id: str
    host_name: str
    is_host: bool
    participant_count: int
    created_at: datetime
    expires_at: datetime
    ended_at: datetime | None


class IceServerResponse(BaseModel):
    """One entry of the RTCConfiguration.iceServers array the browser expects."""

    urls: list[str]
    username: str | None = None
    credential: str | None = None


class IceConfigResponse(BaseModel):
    ice_servers: list[IceServerResponse]
    # Surfaced so the UI can warn that connections may fail on restrictive networks.
    has_turn: bool
