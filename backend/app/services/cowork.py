import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models.cowork import CoworkSession
from app.schemas.cowork import CoworkSessionCreate, CoworkSessionResponse

# token_urlsafe(8) is ~11 characters of base64 over 64 bits of entropy — the link
# is the only thing guarding the room, so it has to be unguessable.
SLUG_ENTROPY_BYTES = 8
MAX_SLUG_ATTEMPTS = 5
DEFAULT_TTL_HOURS = 24
DEFAULT_TITLE = "Cowork session"


#pick a slug that isn't already taken (collisions are vanishingly rare, but cheap to check)
def _generate_unique_slug(db: Session) -> str:
    for _ in range(MAX_SLUG_ATTEMPTS):
        slug = secrets.token_urlsafe(SLUG_ENTROPY_BYTES)
        if db.scalar(select(CoworkSession.id).where(CoworkSession.slug == slug)) is None:
            return slug
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not allocate a room link. Please try again.",
    )


#a room is joinable while it is open and has not passed its expiry
def is_joinable(cowork_session: CoworkSession, now: datetime | None = None) -> bool:
    moment = now or datetime.now(timezone.utc)
    return cowork_session.status == "open" and cowork_session.expires_at > moment


#there is no cron on the free plan, so expired rooms get closed lazily whenever someone reads the list
def close_expired_sessions(db: Session, now: datetime | None = None) -> None:
    moment = now or datetime.now(timezone.utc)
    result = db.execute(
        update(CoworkSession)
        .where(CoworkSession.status == "open", CoworkSession.expires_at <= moment)
        .values(status="ended", ended_at=moment)
    )
    if result.rowcount:
        db.commit()


#create a room for the current user
def create_cowork_session(db: Session, user_id: str, payload: CoworkSessionCreate) -> CoworkSession:
    now = datetime.now(timezone.utc)
    cowork_session = CoworkSession(
        slug=_generate_unique_slug(db),
        host_user_id=user_id,
        title=payload.title or DEFAULT_TITLE,
        status="open",
        expires_at=now + timedelta(hours=DEFAULT_TTL_HOURS),
    )
    db.add(cowork_session)
    db.commit()
    return get_cowork_session_or_404(db, cowork_session.slug)


#look up a room by slug regardless of whether it is still open
def get_cowork_session_or_404(db: Session, slug: str) -> CoworkSession:
    stmt = select(CoworkSession).where(CoworkSession.slug == slug).options(selectinload(CoworkSession.host))
    cowork_session = db.scalar(stmt)
    if not cowork_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cowork session not found")
    return cowork_session


#look up a room that can still be joined — ended and expired rooms read as gone
def get_joinable_cowork_session_or_404(db: Session, slug: str) -> CoworkSession:
    cowork_session = get_cowork_session_or_404(db, slug)
    if not is_joinable(cowork_session):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This cowork session has ended.",
        )
    return cowork_session


#rooms the current user is hosting, freshest first (only ones still usable)
def list_hosted_cowork_sessions(db: Session, user_id: str) -> list[CoworkSession]:
    close_expired_sessions(db)
    stmt = (
        select(CoworkSession)
        .where(CoworkSession.host_user_id == user_id, CoworkSession.status == "open")
        .options(selectinload(CoworkSession.host))
        .order_by(CoworkSession.created_at.desc())
    )
    return list(db.scalars(stmt).unique())


#end a room; only the host may do it and repeating it is a no-op
def end_cowork_session(db: Session, cowork_session: CoworkSession, user_id: str) -> CoworkSession:
    if cowork_session.host_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can end this cowork session",
        )
    if cowork_session.status == "ended":
        return cowork_session

    cowork_session.status = "ended"
    cowork_session.ended_at = datetime.now(timezone.utc)
    db.add(cowork_session)
    db.commit()
    return get_cowork_session_or_404(db, cowork_session.slug)


#build the API shape: adds who is live right now, which only the in-memory registry knows
def serialize_cowork_session(
    cowork_session: CoworkSession,
    current_user_id: str,
    participant_count: int = 0,
) -> CoworkSessionResponse:
    return CoworkSessionResponse(
        id=cowork_session.id,
        slug=cowork_session.slug,
        title=cowork_session.title,
        status=cowork_session.status,
        host_user_id=cowork_session.host_user_id,
        host_name=cowork_session.host.full_name if cowork_session.host else "",
        is_host=cowork_session.host_user_id == current_user_id,
        participant_count=participant_count,
        created_at=cowork_session.created_at,
        expires_at=cowork_session.expires_at,
        ended_at=cowork_session.ended_at,
    )
