from datetime import datetime, timezone

from app.models.habit import Habit
from app.models.user import User
from app.schemas.habits import HabitActiveHours, HabitOccurrenceCreate, HabitUpdate
from app.services.habits import complete_habit, update_habit


def make_habit(db, **overrides):
    user = User(email="habit-unit@example.com", full_name="Unit", hashed_password="irrelevant")
    db.add(user)
    db.commit()
    fields = {"user_id": user.id, "title": "Stretch", "frequency": "daily"}
    fields.update(overrides)
    habit = Habit(**fields)
    db.add(habit)
    db.commit()
    return habit


def test_update_habit_replaces_active_hours(db):
    habit = make_habit(db)
    updated = update_habit(
        db, habit, HabitUpdate(active_hours=HabitActiveHours(start="06:00", end="21:00"))
    )
    assert updated.active_hours == {"start": "06:00", "end": "21:00"}


def test_update_habit_replaces_occurrences(db):
    habit = make_habit(db)
    occurrence = HabitOccurrenceCreate(
        timestamp=datetime(2026, 7, 2, 9, 0, tzinfo=timezone.utc), status="completed"
    )
    updated = update_habit(db, habit, HabitUpdate(occurrences=[occurrence]))
    assert len(updated.occurrences) == 1
    assert updated.occurrences[0].status == "completed"


def test_complete_habit_defaults_to_current_time(db):
    habit = make_habit(db)
    completed = complete_habit(db, habit)
    today = datetime.now(timezone.utc).date().isoformat()
    assert completed.streak == 1
    assert completed.last_completed == today
    assert today in completed.completed_dates
