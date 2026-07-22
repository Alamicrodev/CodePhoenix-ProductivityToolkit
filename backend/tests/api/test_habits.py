from datetime import datetime, timedelta, timezone

from tests.factories import API, habit_payload

TS_DAY1 = "2026-07-01T09:00:00Z"
TS_DAY2 = "2026-07-02T09:00:00Z"


# Streaks are recomputed relative to the real current time, so tests that
# assert on streaks must use timestamps relative to "now" rather than fixed
# dates (fixed dates rot as real time moves past them).
def iso_ts(days_ago: int = 0, hours_ago: int = 0) -> str:
    moment = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_ago)
    return moment.isoformat().replace("+00:00", "Z")


def day_key(days_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).date().isoformat()


def create_habit(client, headers, **overrides):
    response = client.post(f"{API}/habits", json=habit_payload(**overrides), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def complete(client, headers, habit_id, timestamp):
    response = client.post(
        f"{API}/habits/{habit_id}/complete", json={"timestamp": timestamp}, headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_create_habit_returns_full_shape(client, auth_headers):
    body = create_habit(client, auth_headers)
    assert body["title"] == "Drink water"
    assert body["frequency"] == "daily"
    assert body["active_days"] == [0, 1, 2, 3, 4]
    assert body["active_hours"] == {"start": "08:00", "end": "20:00"}
    assert body["streak"] == 0
    assert body["completed_dates"] == []
    assert body["occurrences"] == []
    assert body["id"] and body["created_at"] and body["updated_at"]


def test_create_habit_minimal_uses_defaults(client, auth_headers):
    response = client.post(
        f"{API}/habits", json={"title": "Minimal", "frequency": "daily"}, headers=auth_headers
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["description"] == ""
    assert body["active_days"] == []
    assert body["active_hours"] is None
    assert body["last_completed"] is None


def test_create_habit_invalid_frequency_rejected(client, auth_headers):
    response = client.post(
        f"{API}/habits", json=habit_payload(frequency="yearly"), headers=auth_headers
    )
    assert response.status_code == 422


def test_complete_daily_habit_records_streak_date_and_occurrence(client, auth_headers):
    habit = create_habit(client, auth_headers, active_days=[])
    body = complete(client, auth_headers, habit["id"], iso_ts())
    assert body["streak"] == 1
    assert body["completed_dates"] == [day_key()]
    assert body["last_completed"] == day_key()
    assert len(body["occurrences"]) == 1
    assert body["occurrences"][0]["status"] == "completed"


def test_complete_daily_habit_twice_same_day_is_idempotent(client, auth_headers):
    habit = create_habit(client, auth_headers, active_days=[])
    moment = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    complete(client, auth_headers, habit["id"], moment.isoformat())
    body = complete(
        client, auth_headers, habit["id"], (moment + timedelta(minutes=30)).isoformat()
    )
    assert body["streak"] == 1
    assert body["completed_dates"] == [day_key()]
    assert len(body["occurrences"]) == 1


def test_complete_hourly_habit_accumulates_per_timestamp(client, auth_headers):
    habit = create_habit(
        client, auth_headers, frequency="hourly", hourly_interval=1, active_days=[], active_hours=None
    )
    complete(client, auth_headers, habit["id"], iso_ts(hours_ago=1))
    body = complete(client, auth_headers, habit["id"], iso_ts())
    assert len(body["completed_dates"]) == 2
    assert len(body["occurrences"]) == 2
    # Only the current slot counts toward the streak: the hour-ago slot ended
    # before the habit's created_at, and slots predating creation are excluded.
    assert body["streak"] == 1


def test_undo_completion_reverts_streak_dates_and_occurrences(client, auth_headers):
    habit = create_habit(client, auth_headers)
    complete(client, auth_headers, habit["id"], TS_DAY2)
    response = client.post(
        f"{API}/habits/{habit['id']}/undo",
        json={"completion_timestamp": "2026-07-02"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["streak"] == 0
    assert body["completed_dates"] == []
    assert body["occurrences"] == []
    assert body["last_completed"] is None


def test_undo_recomputes_last_completed_from_remaining_dates(client, auth_headers):
    habit = create_habit(client, auth_headers, active_days=[])
    complete(client, auth_headers, habit["id"], iso_ts(days_ago=1))
    complete(client, auth_headers, habit["id"], iso_ts())
    response = client.post(
        f"{API}/habits/{habit['id']}/undo",
        json={"completion_timestamp": day_key()},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    # Yesterday's completion predates the habit's created_at, so it does not
    # count toward the streak, but it still drives last_completed.
    assert body["streak"] == 0
    assert body["completed_dates"] == [day_key(1)]
    assert body["last_completed"] == day_key(1)
    assert len(body["occurrences"]) == 1


def test_backfill_past_day_records_marker_without_streak(client, auth_headers):
    habit = create_habit(client, auth_headers, active_days=[])
    body = complete(client, auth_headers, habit["id"], iso_ts(days_ago=3))
    assert body["completed_dates"] == [day_key(3)]
    assert body["last_completed"] == day_key(3)
    assert body["streak"] == 0


def test_backfill_streak_counts_only_days_since_creation(client, auth_headers):
    habit = create_habit(client, auth_headers, active_days=[])
    complete(client, auth_headers, habit["id"], iso_ts(days_ago=1))
    body = complete(client, auth_headers, habit["id"], iso_ts())
    assert body["completed_dates"] == [day_key(1), day_key()]
    assert body["streak"] == 1


def test_undo_without_completion_is_safe(client, auth_headers):
    habit = create_habit(client, auth_headers)
    response = client.post(
        f"{API}/habits/{habit['id']}/undo",
        json={"completion_timestamp": "2026-07-02"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["streak"] == 0


def test_patch_habit_updates_only_sent_fields(client, auth_headers):
    habit = create_habit(client, auth_headers)
    response = client.patch(
        f"{API}/habits/{habit['id']}",
        json={"title": "Drink more water", "streak": 5},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Drink more water"
    assert body["streak"] == 0
    assert body["frequency"] == habit["frequency"]
    assert body["active_hours"] == habit["active_hours"]


def test_streak_is_recomputed_from_persisted_progress(client, auth_headers):
    habit = create_habit(client, auth_headers)

    response = client.patch(
        f"{API}/habits/{habit['id']}",
        json={"streak": 99, "last_completed": "2026-07-09", "completed_dates": []},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["streak"] == 0
    assert body["last_completed"] is None
    assert body["completed_dates"] == []


def test_delete_habit(client, auth_headers):
    habit = create_habit(client, auth_headers)
    response = client.delete(f"{API}/habits/{habit['id']}", headers=auth_headers)
    assert response.status_code == 204
    assert client.get(f"{API}/habits/{habit['id']}", headers=auth_headers).status_code == 404


def test_missing_habit_returns_404(client, auth_headers):
    assert client.get(f"{API}/habits/nope", headers=auth_headers).status_code == 404
    assert (
        client.post(
            f"{API}/habits/nope/complete", json={"timestamp": TS_DAY2}, headers=auth_headers
        ).status_code
        == 404
    )
