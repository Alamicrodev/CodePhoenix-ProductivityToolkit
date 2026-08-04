from datetime import datetime, timezone, timedelta

from app.models.habit import Habit
from app.services.habit_progress import recalculate_habit_progress


PKT = timezone(timedelta(hours=5))


def make_hourly_habit(**overrides):
    fields = {
        "user_id": "u1",
        "title": "Drink water",
        "frequency": "hourly",
        "hourly_interval": 3,
        "active_hours_start": "07:00",
        "active_hours_end": "22:00",
        "active_days": [],
        "completed_dates": [],
        "created_at": datetime(2026, 8, 4, 0, 0, tzinfo=PKT),
    }
    fields.update(overrides)
    return Habit(**fields)


def test_hourly_streak_counts_current_local_offset_slot():
    habit = make_hourly_habit(completed_dates=["2026-08-04T07:00:00+05:00"])

    recalculate_habit_progress(habit, datetime(2026, 8, 4, 7, 56, tzinfo=PKT))

    assert habit.streak == 1
    assert habit.last_completed == "2026-08-04T07:00:00+05:00"


def test_hourly_streak_counts_consecutive_local_offset_slots():
    habit = make_hourly_habit(
        completed_dates=[
            "2026-08-04T07:00:00+05:00",
            "2026-08-04T10:00:00+05:00",
        ],
    )

    recalculate_habit_progress(habit, datetime(2026, 8, 4, 10, 56, tzinfo=PKT))

    assert habit.streak == 2
