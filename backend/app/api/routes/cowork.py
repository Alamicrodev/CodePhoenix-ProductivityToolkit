from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.cowork import (
    CoworkSessionCreate,
    CoworkSessionResponse,
    IceConfigResponse,
    IceServerResponse,
)
from app.services.cowork import (
    create_cowork_session,
    end_cowork_session,
    get_cowork_session_or_404,
    get_joinable_cowork_session_or_404,
    list_hosted_cowork_sessions,
    serialize_cowork_session,
)
from app.services.cowork_rooms import room_registry

router = APIRouter(prefix="/cowork-sessions", tags=["cowork-sessions"])
settings = get_settings()


#rooms the current user is hosting
@router.get("", response_model=list[CoworkSessionResponse])
def get_cowork_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = list_hosted_cowork_sessions(db, current_user.id)
    return [
        serialize_cowork_session(session, current_user.id, room_registry.participant_count(session.slug))
        for session in sessions
    ]


#create a room and get back the slug that forms the share link
@router.post("", response_model=CoworkSessionResponse, status_code=status.HTTP_201_CREATED)
def create_cowork_session_route(
    payload: CoworkSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cowork_session = create_cowork_session(db, current_user.id, payload)
    return serialize_cowork_session(cowork_session, current_user.id, 0)


#ICE servers for the browser's RTCPeerConnection.
#declared before /{slug} so the literal path wins the match.
@router.get("/ice-config", response_model=IceConfigResponse)
def get_ice_config(current_user: User = Depends(get_current_user)):
    ice_servers = [IceServerResponse(urls=list(settings.stun_urls))]
    if settings.turn_urls:
        ice_servers.append(
            IceServerResponse(
                urls=list(settings.turn_urls),
                username=settings.turn_username,
                credential=settings.turn_credential,
            )
        )
    return IceConfigResponse(ice_servers=ice_servers, has_turn=bool(settings.turn_urls))


#room details for the join page — 404s once the room has ended or expired
@router.get("/{slug}", response_model=CoworkSessionResponse)
def get_cowork_session(slug: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cowork_session = get_joinable_cowork_session_or_404(db, slug)
    return serialize_cowork_session(cowork_session, current_user.id, room_registry.participant_count(slug))


#host-only: close the room for everyone
@router.post("/{slug}/end", response_model=CoworkSessionResponse)
def end_cowork_session_route(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cowork_session = get_cowork_session_or_404(db, slug)
    ended = end_cowork_session(db, cowork_session, current_user.id)
    return serialize_cowork_session(ended, current_user.id, room_registry.participant_count(slug))
