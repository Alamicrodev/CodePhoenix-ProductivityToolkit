from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.focus_sessions import FocusSessionActionRequest, FocusSessionCreate, FocusSessionResponse, FocusSessionUpdate
from app.services.focus_sessions import apply_focus_session_action, create_focus_session, delete_focus_session, get_focus_session_or_404, list_focus_sessions, mark_focus_session_item_complete, update_focus_session

router = APIRouter(prefix="/focus-sessions", tags=["focus-sessions"])


@router.get("", response_model=list[FocusSessionResponse])
def get_focus_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list:
    return list_focus_sessions(db, current_user.id)


@router.post("", response_model=FocusSessionResponse, status_code=status.HTTP_201_CREATED)
def create_focus_session_route(payload: FocusSessionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_focus_session(db, current_user.id, payload)


@router.get("/{session_id}", response_model=FocusSessionResponse)
def get_focus_session(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_focus_session_or_404(db, current_user.id, session_id)


@router.patch("/{session_id}", response_model=FocusSessionResponse)
def update_focus_session_route(session_id: str, payload: FocusSessionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    focus_session = get_focus_session_or_404(db, current_user.id, session_id)
    return update_focus_session(db, focus_session, payload)


@router.post("/{session_id}/{action}", response_model=FocusSessionResponse)
def focus_session_action_route(session_id: str, action: str, payload: FocusSessionActionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    focus_session = get_focus_session_or_404(db, current_user.id, session_id)
    return apply_focus_session_action(db, focus_session, action, payload.timestamp)


@router.post("/{session_id}/items/{item_id}/complete", response_model=FocusSessionResponse)
def complete_focus_session_item_route(session_id: str, item_id: str, payload: FocusSessionActionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    focus_session = get_focus_session_or_404(db, current_user.id, session_id)
    return mark_focus_session_item_complete(db, focus_session, item_id, payload.timestamp)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_focus_session_route(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    focus_session = get_focus_session_or_404(db, current_user.id, session_id)
    delete_focus_session(db, focus_session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
