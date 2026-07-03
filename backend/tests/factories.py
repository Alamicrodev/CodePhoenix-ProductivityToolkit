"""Request-payload factories shared across the API tests.

Each factory returns a fresh, valid payload dict; pass keyword overrides to
vary individual fields (e.g. ``task_payload(title="Other")``).
"""

API = "/api/v1"
DEFAULT_PASSWORD = "password123"


def task_payload(**overrides):
    payload = {
        "title": "Write report",
        "description": "Q3 summary",
        "priority": "high",
        "due_date": "2026-07-10",
        "tags": ["work", "urgent"],
        "quadrant": "urgent-important",
        "subtasks": [{"title": "Draft outline"}],
    }
    payload.update(overrides)
    return payload


def habit_payload(**overrides):
    payload = {
        "title": "Drink water",
        "description": "8 glasses",
        "frequency": "daily",
        "active_days": [0, 1, 2, 3, 4],
        "active_hours": {"start": "08:00", "end": "20:00"},
    }
    payload.update(overrides)
    return payload


def focus_session_payload(**overrides):
    payload = {
        "title": "Deep work",
        "total_duration_minutes": 50,
        "focus_length_minutes": 25,
        "break_length_minutes": 5,
        "phase_remaining_seconds": 1500,
        "status": "active",
        "started_at": "2026-07-02T08:00:00Z",
        "items": [],
    }
    payload.update(overrides)
    return payload


def focus_item_payload(**overrides):
    payload = {
        "source_id": "task-1",
        "source_type": "task",
        "title": "Write report",
        "added_at": "2026-07-02T08:00:00Z",
    }
    payload.update(overrides)
    return payload
