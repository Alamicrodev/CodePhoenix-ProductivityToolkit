from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.focus_session import FocusSession
from app.models.user import User
from app.services.focus_sessions import (
    apply_focus_session_action,
    mark_focus_session_item_complete,
)


def make_session(db):
    user = User(email="focus-unit@example.com", full_name="Unit", hashed_password="irrelevant")
    db.add(user)
    db.commit()
    session = FocusSession(
        user_id=user.id,
        title="Deep work",
        total_duration_minutes=50,
        focus_length_minutes=25,
        break_length_minutes=5,
        phase_remaining_seconds=1500,
        started_at=datetime(2026, 7, 2, 8, 0, tzinfo=timezone.utc),
    )
    db.add(session)
    db.commit()
    return session


def test_pause_uses_provided_timestamp(db):
    session = make_session(db)
    at = datetime(2026, 7, 2, 8, 30, tzinfo=timezone.utc)
    paused = apply_focus_session_action(db, session, "pause", at)
    assert paused.status == "paused"
    assert paused.paused_at == at
    assert paused.updated_at == at


def test_unknown_action_raises_400(db):
    session = make_session(db)
    with pytest.raises(HTTPException) as excinfo:
        apply_focus_session_action(db, session, "explode")
    assert excinfo.value.status_code == 400


def test_completing_missing_item_raises_404(db):
    session = make_session(db)
    with pytest.raises(HTTPException) as excinfo:
        mark_focus_session_item_complete(db, session, "missing-item")
    assert excinfo.value.status_code == 404
