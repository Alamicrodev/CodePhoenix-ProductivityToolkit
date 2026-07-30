"""Proxy between room participants and the Cloudflare SFU API.

The browser owns the PeerConnection and builds the SDP; Cloudflare validates
it. These routes exist to (a) keep the App Secret server-side and (b) ensure
only someone actually connected to a room can create sessions or route tracks
through our Cloudflare app.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import sfu
from app.services.cowork import get_joinable_cowork_session_or_404
from app.services.cowork_rooms import room_registry

router = APIRouter(prefix="/cowork-sessions/{slug}/sfu", tags=["cowork-sfu"])


#auth alone is not enough: the caller must be live in this room's registry,
#otherwise any account could burn our Cloudflare egress from outside the room
def require_live_membership(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    get_joinable_cowork_session_or_404(db, slug)
    if not room_registry.has_user(slug, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Join the room before starting video",
        )


def _sfu_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except sfu.SfuError as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error


class CreateSessionRequest(BaseModel):
    # Receive-only participants bootstrap with an initial (data-channel) offer;
    # publishers omit it and negotiate via /publish instead.
    session_description: dict[str, Any] | None = None


class SfuSessionResponse(BaseModel):
    session_id: str
    # Cloudflare's answer to a bootstrap offer; null for bare sessions.
    session_description: dict[str, Any] | None = None


class PublishRequest(BaseModel):
    session_id: str
    # The browser's offer and its track descriptors, passed through to Cloudflare.
    session_description: dict[str, Any]
    tracks: list[dict[str, Any]] = Field(min_length=1)


class SubscribeRequest(BaseModel):
    session_id: str
    remote_session_id: str
    track_names: list[str] = Field(min_length=1)


class RenegotiateRequest(BaseModel):
    session_id: str
    session_description: dict[str, Any]


class CloseTracksRequest(BaseModel):
    session_id: str
    tracks: list[dict[str, Any]] = Field(min_length=1)
    session_description: dict[str, Any] | None = None
    force: bool = False


#one Cloudflare session per participant (their single PeerConnection)
@router.post("/session", response_model=SfuSessionResponse, dependencies=[Depends(require_live_membership)])
def create_sfu_session(payload: CreateSessionRequest | None = None):
    created = _sfu_call(sfu.create_session, payload.session_description if payload else None)
    return SfuSessionResponse(**created)


#publish local camera/mic tracks: browser offer in, Cloudflare answer out
@router.post("/publish", dependencies=[Depends(require_live_membership)])
def publish_tracks(payload: PublishRequest) -> dict[str, Any]:
    return _sfu_call(
        sfu.new_tracks,
        payload.session_id,
        payload.tracks,
        payload.session_description,
    )


#subscribe to another participant's published tracks: Cloudflare responds with
#an offer that the client answers via /renegotiate
@router.post("/subscribe", dependencies=[Depends(require_live_membership)])
def subscribe_tracks(payload: SubscribeRequest) -> dict[str, Any]:
    tracks = [
        {"location": "remote", "sessionId": payload.remote_session_id, "trackName": name}
        for name in payload.track_names
    ]
    return _sfu_call(sfu.new_tracks, payload.session_id, tracks)


#complete a Cloudflare-initiated renegotiation
@router.put("/renegotiate", dependencies=[Depends(require_live_membership)])
def renegotiate_session(payload: RenegotiateRequest) -> dict[str, Any]:
    return _sfu_call(sfu.renegotiate, payload.session_id, payload.session_description)


#best-effort unpublish; Cloudflare garbage-collects silent tracks after 30s anyway
@router.put("/close-tracks", dependencies=[Depends(require_live_membership)])
def close_session_tracks(payload: CloseTracksRequest) -> dict[str, Any]:
    return _sfu_call(
        sfu.close_tracks,
        payload.session_id,
        payload.tracks,
        payload.session_description,
        payload.force,
    )
