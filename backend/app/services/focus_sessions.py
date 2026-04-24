from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.focus_session import FocusSession, FocusSessionItem
from app.schemas.focus_sessions import FocusSessionCreate, FocusSessionUpdate


def list_focus_sessions(db: Session, user_id: str) -> list[FocusSession]:
    stmt = select(FocusSession).where(FocusSession.user_id == user_id).options(selectinload(FocusSession.items)).order_by(FocusSession.created_at.desc())
    return list(db.scalars(stmt).unique())


def get_focus_session_or_404(db: Session, user_id: str, session_id: str) -> FocusSession:
    stmt = select(FocusSession).where(FocusSession.id == session_id, FocusSession.user_id == user_id).options(selectinload(FocusSession.items))
    session = db.scalar(stmt)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Focus session not found")
    return session


def create_focus_session(db: Session, user_id: str, payload: FocusSessionCreate) -> FocusSession:
    session = FocusSession(
        user_id=user_id,
        title=payload.title,
        total_duration_minutes=payload.total_duration_minutes,
        focus_length_minutes=payload.focus_length_minutes,
        break_length_minutes=payload.break_length_minutes,
        elapsed_seconds=payload.elapsed_seconds,
        phase_type=payload.phase_type,
        phase_remaining_seconds=payload.phase_remaining_seconds,
        status=payload.status,
        completion_result=payload.completion_result,
        completed=payload.completed,
        completed_focus_blocks=payload.completed_focus_blocks,
        started_at=payload.started_at,
        paused_at=payload.paused_at,
        ended_at=payload.ended_at,
        items=[
            FocusSessionItem(
                source_id=item.source_id,
                source_type=item.source_type,
                title=item.title,
                added_at=item.added_at,
                completed_in_session_at=item.completed_in_session_at,
            )
            for item in payload.items
        ],
    )
    db.add(session)
    db.commit()
    return get_focus_session_or_404(db, user_id, session.id)


def update_focus_session(db: Session, focus_session: FocusSession, payload: FocusSessionUpdate) -> FocusSession:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(focus_session, field, value)
    db.add(focus_session)
    db.commit()
    return get_focus_session_or_404(db, focus_session.user_id, focus_session.id)


def apply_focus_session_action(db: Session, focus_session: FocusSession, action: str, timestamp: datetime | None = None) -> FocusSession:
    action_time = timestamp or datetime.now(timezone.utc)
    if action == "pause":
        focus_session.status = "paused"
        focus_session.paused_at = action_time
    elif action == "resume":
        focus_session.status = "active"
        focus_session.paused_at = None
    elif action == "complete":
        focus_session.status = "completed"
        focus_session.completed = True
        focus_session.ended_at = action_time
    elif action == "quit":
        focus_session.status = "quit"
        focus_session.ended_at = action_time
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported action")

    focus_session.updated_at = action_time
    db.add(focus_session)
    db.commit()
    return get_focus_session_or_404(db, focus_session.user_id, focus_session.id)


def mark_focus_session_item_complete(db: Session, focus_session: FocusSession, item_id: str, timestamp: datetime | None = None) -> FocusSession:
    action_time = timestamp or datetime.now(timezone.utc)
    item = next((session_item for session_item in focus_session.items if session_item.id == item_id), None)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Focus session item not found")

    item.completed_in_session_at = action_time
    focus_session.updated_at = action_time
    db.add(focus_session)
    db.commit()
    return get_focus_session_or_404(db, focus_session.user_id, focus_session.id)


def delete_focus_session(db: Session, focus_session: FocusSession) -> None:
    db.delete(focus_session)
    db.commit()
