"""Unit tests for the AI scheduler service.

The schedule must stay useful when Gemini is slow, misconfigured, down, or
returns junk — every one of those degrades to the heuristic baseline built from
the user's real tasks and habits, never to an error. The label helpers are
tested against a fixed reference time so the expectations stay deterministic.
"""

import io
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from urllib import error
from zoneinfo import ZoneInfo

from app.schemas.ai_scheduler import AiSchedulerItem
from app.services import ai_scheduler as service


# Wednesday morning (JS day-of-week 3), timezone-aware like every real caller.
NOW = datetime(2026, 7, 22, 9, 30, tzinfo=timezone.utc)


def fake_task(**overrides):
    task = SimpleNamespace(
        id="task-1",
        title="Write report",
        priority="high",
        completed=False,
        due_date="2026-07-22",
        due_time=None,
        tags=["work"],
        subtasks=[SimpleNamespace(completed=True), SimpleNamespace(completed=False)],
    )
    task.__dict__.update(overrides)
    return task


def fake_habit(**overrides):
    habit = SimpleNamespace(
        id="habit-1",
        title="Drink water",
        frequency="daily",
        streak=3,
        active_days=[],
        active_hours=None,
        active_hours_start=None,
        active_hours_end=None,
        hourly_interval=None,
        completed_dates=[],
        occurrences=[],
    )
    habit.__dict__.update(overrides)
    return habit


def valid_item(**overrides):
    item = {"time": "9:00 AM", "title": "Deep work", "type": "task", "priority": "high", "duration": "45 min"}
    item.update(overrides)
    return item


# --- time helpers -----------------------------------------------------------


def test_now_local_converts_into_the_requested_timezone():
    local = service._now_local(NOW, "Asia/Kolkata")
    assert (local.hour, local.minute) == (15, 0)
    assert local.tzinfo == ZoneInfo("Asia/Kolkata")


def test_now_local_treats_naive_input_as_utc_and_survives_unknown_zones():
    assert service._now_local(datetime(2026, 7, 22, 9, 30), None).tzinfo == timezone.utc
    assert service._now_local(NOW, "Not/AZone").hour == 9


def test_js_day_of_week_uses_sunday_zero():
    assert service._js_day_of_week(datetime(2026, 7, 26)) == 0  # Sunday
    assert service._js_day_of_week(datetime(2026, 7, 22)) == 3  # Wednesday


def test_clock_format_handles_midnight_and_noon():
    assert service._format_clock_12(datetime(2026, 7, 22, 0, 5)) == "12:05 AM"
    assert service._format_clock_12(datetime(2026, 7, 22, 12, 0)) == "12:00 PM"
    assert service._format_clock_12(datetime(2026, 7, 22, 15, 7)) == "3:07 PM"


def test_relative_day_labels():
    assert service._format_relative_day_label(NOW, NOW) == "Today"
    assert service._format_relative_day_label(NOW + timedelta(days=1), NOW) == "Tomorrow"
    assert service._format_relative_day_label(NOW + timedelta(days=4), NOW) == "Sun"
    assert service._format_relative_day_label(datetime(2026, 8, 11, tzinfo=timezone.utc), NOW) == "Tue, Aug 11"


# --- task due labels --------------------------------------------------------


def test_task_due_detail_without_due_date_is_none():
    assert service._task_due_detail(fake_task(due_date=None), NOW) is None


def test_task_due_detail_with_a_time_counts_down_to_it():
    assert service._task_due_detail(fake_task(due_time="09:00"), NOW) == "Overdue"
    assert service._task_due_detail(fake_task(due_time="10:00"), NOW) == "Due in 30 min"
    assert service._task_due_detail(fake_task(due_time="10:30"), NOW) == "Due in 1 hour"
    assert service._task_due_detail(fake_task(due_time="11:30"), NOW) == "Due in 2 hours"


def test_task_due_detail_without_a_time_uses_day_buckets():
    assert service._task_due_detail(fake_task(), NOW) == "Due today"
    assert service._task_due_detail(fake_task(due_date="2026-07-23"), NOW) == "Due tomorrow"
    assert service._task_due_detail(fake_task(due_date="2026-07-27"), NOW) == "Due this week"
    assert service._task_due_detail(fake_task(due_date="2026-08-11"), NOW) == "Due Aug 11"


# --- habit availability -----------------------------------------------------


def test_daily_habit_open_today_is_available_now():
    assert service._habit_availability_label(fake_habit(), NOW) == "Available now · Due today"


def test_daily_habit_completed_today_points_at_tomorrow():
    habit = fake_habit(completed_dates=["2026-07-22T05:00:00Z"])
    assert service._habit_availability_label(habit, NOW) == "Next window: Tomorrow"


def test_daily_habit_with_inactive_today_names_the_next_active_day():
    habit = fake_habit(active_days=[0])  # Sundays only; next is Jul 26
    assert service._habit_availability_label(habit, NOW) == "Next window: Sun"


def test_hourly_habit_inside_its_window_counts_down():
    habit = fake_habit(frequency="hourly", active_hours_start="08:00", active_hours_end="10:00")
    assert service._habit_availability_label(habit, NOW) == "Available now · Due in 30 min"

    habit = fake_habit(frequency="hourly", active_hours_start="08:00", active_hours_end="13:30")
    assert service._habit_availability_label(habit, NOW) == "Available now · Due in 4 hours"


def test_hourly_habit_outside_its_window_names_the_next_one():
    habit = fake_habit(frequency="hourly", active_hours_start="22:00", active_hours_end="23:00")
    assert service._habit_availability_label(habit, NOW) == "Next window: Tomorrow 10:00 PM"


def test_weekly_habit_tracks_the_current_week():
    assert service._habit_availability_label(fake_habit(frequency="weekly"), NOW) == "Available now · Due this week"

    done = fake_habit(frequency="weekly", completed_dates=["2026-07-21T10:00:00Z"])
    assert service._habit_availability_label(done, NOW) == "Next window: Sun"

    # Unparseable markers must not crash the label; they simply do not count.
    junk = fake_habit(frequency="weekly", completed_dates=["not-a-date"])
    assert service._habit_availability_label(junk, NOW) == "Available now · Due this week"


# --- baseline schedule ------------------------------------------------------


def test_baseline_sorts_tasks_by_priority_then_due_date_and_caps_them():
    tasks = [
        fake_task(id="low", title="Low", priority="low", due_date="2026-07-23"),
        fake_task(id="high-late", title="High late", due_date="2026-07-30"),
        fake_task(id="high-soon", title="High soon", due_date="2026-07-22"),
        fake_task(id="medium", title="Medium", priority="medium", due_date="2026-07-22"),
        fake_task(id="done", title="Done", completed=True),
        fake_task(id="undated", title="Undated", due_date=None),
    ]

    items = service._build_baseline_items(tasks, [], NOW)

    assert items[0]["title"] == "Morning planning session"
    assert [item["title"] for item in items[1:5]] == ["High soon", "High late", "Medium", "Low"]
    # Completed and undated tasks never appear; the evening review closes the day.
    assert all(item["title"] not in {"Done", "Undated"} for item in items)
    assert items[-1]["type"] == "review"


def test_baseline_includes_at_most_three_habits_and_eight_items():
    habits = [fake_habit(id=f"habit-{i}", title=f"Habit {i}") for i in range(4)]
    habits.append(fake_habit(id="off", title="Off", frequency="someday"))
    tasks = [fake_task(id=f"task-{i}", title=f"Task {i}", due_date="2026-07-23") for i in range(5)]

    items = service._build_baseline_items(tasks, habits, NOW)

    assert len(items) == 8
    assert sum(1 for item in items if item["type"] == "habit") == 3
    assert all(item["title"] != "Off" for item in items)


def test_baseline_without_tasks_skips_the_review_block():
    items = service._build_baseline_items([], [fake_habit()], NOW)
    assert [item["type"] for item in items] == ["planning", "habit"]


def test_serialized_items_carry_source_references():
    task_item = service._serialize_task(fake_task(due_time="10:00"), NOW)
    assert task_item["time"] == "10:00 AM"
    assert (task_item["source_id"], task_item["source_type"]) == ("task-1", "task")

    habit_item = service._serialize_habit(fake_habit(frequency="hourly", active_hours_start="08:00", active_hours_end="10:00"), NOW)
    assert habit_item["time"] == "Now"
    assert habit_item["priority"] == "high"
    assert (habit_item["source_id"], habit_item["source_type"]) == ("habit-1", "habit")


# --- prompt building --------------------------------------------------------


def test_prompt_grounds_the_model_in_real_workspace_data():
    habit = fake_habit(
        active_hours={"start": "08:00", "end": "20:00"},
        occurrences=[SimpleNamespace(timestamp=NOW, status="completed")],
    )
    sessions = [
        SimpleNamespace(
            id="focus-1",
            title="Deep work",
            status="active",
            items=[SimpleNamespace(source_type="task", source_id="task-1", title="Write report")],
        ),
        SimpleNamespace(id="focus-2", title="Old", status="completed", items=[]),
    ]

    prompt = service._build_scheduler_prompt([fake_task()], [habit], sessions, NOW)

    assert prompt["current_time"] == NOW.isoformat()
    assert prompt["time_zone"] == "UTC"
    assert prompt["tasks"][0]["id"] == "task-1"
    assert prompt["tasks"][0]["subtask_count"] == 2
    assert prompt["tasks"][0]["subtasks_completed"] == 1
    assert prompt["habits"][0]["recent_occurrences"] == [{"timestamp": NOW.isoformat(), "status": "completed"}]
    # Finished focus sessions say nothing about what to do next.
    assert [entry["id"] for entry in prompt["active_focus_sessions"]] == ["focus-1"]
    assert prompt["baseline_schedule"][0]["title"] == "Morning planning session"


# --- model output parsing ---------------------------------------------------


def test_extract_json_payload_accepts_fences_and_prose():
    assert service._extract_json_payload('{"a": 1}') == {"a": 1}
    assert service._extract_json_payload('```json\n{"a": 1}\n```') == {"a": 1}
    assert service._extract_json_payload('Sure! {"a": 1} — hope that helps.') == {"a": 1}
    assert service._extract_json_payload("[1, 2]") == [1, 2]


def test_extract_json_payload_rejects_junk():
    assert service._extract_json_payload("") is None
    assert service._extract_json_payload("no json here") is None
    assert service._extract_json_payload("{broken") is None
    assert service._extract_json_payload("{not: valid}") is None


def test_extract_output_text_reads_the_shapes_gemini_uses():
    assert service._extract_output_text({"output_text": "hi"}) == "hi"
    assert service._extract_output_text({"response": {"output_text": "hi"}}) == "hi"
    gemini = {"candidates": [{"content": {"parts": [{"text": "payload"}]}}]}
    assert service._extract_output_text(gemini) == "payload"
    assert service._extract_output_text({"data": {"deep": {"text": "t"}}}) == "t"
    assert service._extract_output_text("just a string") is None
    assert service._extract_output_text({}) is None


def test_normalize_items_drops_invalid_entries_and_caps_at_eight():
    items = [valid_item(title=f"Item {i}") for i in range(10)]
    items.insert(2, valid_item(type="party"))
    items.insert(5, valid_item(title=""))

    normalized = service._normalize_items(items)

    assert len(normalized) == 8
    assert all(isinstance(item, AiSchedulerItem) for item in normalized)
    assert all(item.type == "task" for item in normalized)


# --- the Gemini call --------------------------------------------------------


class FakeHTTPResponse:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_gemini_call_sends_the_key_schema_and_prompt(monkeypatch):
    captured = {}
    content = json.dumps({"summary": "s", "items": [valid_item()]})

    def fake_urlopen(req, timeout):
        captured["request"] = req
        captured["timeout"] = timeout
        return FakeHTTPResponse({"output_text": content})

    monkeypatch.setattr(service.request, "urlopen", fake_urlopen)

    parsed = service._call_gemini_scheduler("gemini-test", {"tasks": []}, 30, "key-abc")

    assert parsed == {"summary": "s", "items": [valid_item()]}
    req = captured["request"]
    assert captured["timeout"] == 30
    assert req.get_header("X-goog-api-key") == "key-abc"
    body = json.loads(req.data.decode("utf-8"))
    assert body["model"] == "gemini-test"
    assert json.loads(body["input"]) == {"tasks": []}
    assert body["response_format"]["schema"]["required"] == ["summary", "items"]


def test_gemini_call_wraps_a_bare_array_in_items(monkeypatch):
    response = {"output_text": json.dumps([valid_item()])}
    monkeypatch.setattr(service.request, "urlopen", lambda req, timeout: FakeHTTPResponse(response))

    assert service._call_gemini_scheduler("m", {}, 30, "k") == {"items": [valid_item()]}


def test_gemini_http_errors_degrade_to_none(monkeypatch):
    def explode(req, timeout):
        raise error.HTTPError("https://gemini", 429, "quota", None, io.BytesIO(b"slow down"))

    monkeypatch.setattr(service.request, "urlopen", explode)
    assert service._call_gemini_scheduler("m", {}, 30, "k") is None


def test_gemini_network_failures_degrade_to_none(monkeypatch):
    def explode(req, timeout):
        raise error.URLError("dns is down")

    monkeypatch.setattr(service.request, "urlopen", explode)
    assert service._call_gemini_scheduler("m", {}, 30, "k") is None


def test_gemini_junk_output_degrades_to_none(monkeypatch):
    monkeypatch.setattr(service.request, "urlopen", lambda req, timeout: FakeHTTPResponse({"output_text": "not json"}))
    assert service._call_gemini_scheduler("m", {}, 30, "k") is None

    monkeypatch.setattr(service.request, "urlopen", lambda req, timeout: FakeHTTPResponse({"weird": 1}))
    assert service._call_gemini_scheduler("m", {}, 30, "k") is None


# --- build_ai_schedule orchestration ----------------------------------------


def use_workspace(monkeypatch, tasks=(), habits=(), sessions=()):
    monkeypatch.setattr(service, "list_tasks", lambda db, user_id: list(tasks))
    monkeypatch.setattr(service, "list_habits", lambda db, user_id: list(habits))
    monkeypatch.setattr(service, "list_focus_sessions", lambda db, user_id: list(sessions))


def test_schedule_without_an_api_key_is_the_heuristic_baseline(monkeypatch):
    use_workspace(monkeypatch, tasks=[fake_task()])
    monkeypatch.setattr(service.get_settings(), "gemini_api_key", "")

    response = service.build_ai_schedule(None, "user-1", NOW, "UTC")

    assert response.fallback_used is True
    assert response.model == "heuristic-fallback"
    assert response.items[0].title == "Morning planning session"
    assert any(item.source_id == "task-1" for item in response.items)


def test_schedule_uses_the_model_output_when_it_is_valid(monkeypatch):
    use_workspace(monkeypatch, tasks=[fake_task()])
    settings = service.get_settings()
    monkeypatch.setattr(settings, "gemini_api_key", "key-abc")
    captured = {}

    def fake_call(model, prompt, timeout_seconds, api_key):
        captured["prompt"] = prompt
        return {"summary": "Focus on the report.", "items": [valid_item(), valid_item(type="party")]}

    monkeypatch.setattr(service, "_call_gemini_scheduler", fake_call)

    response = service.build_ai_schedule(None, "user-1", NOW, "UTC")

    assert response.fallback_used is False
    assert response.model == settings.scheduler_model
    assert response.summary == "Focus on the report."
    # Invalid entries are dropped rather than failing the whole schedule.
    assert [item.title for item in response.items] == ["Deep work"]
    assert captured["prompt"]["tasks"][0]["id"] == "task-1"


def test_schedule_falls_back_when_the_model_fails_or_returns_junk(monkeypatch):
    use_workspace(monkeypatch, tasks=[fake_task()])
    monkeypatch.setattr(service.get_settings(), "gemini_api_key", "key-abc")

    for bad_result in [None, {"summary": "no items"}, {"items": "nope"}, {"items": [valid_item(type="party")]}]:
        monkeypatch.setattr(service, "_call_gemini_scheduler", lambda *args, _r=bad_result, **kwargs: _r)
        response = service.build_ai_schedule(None, "user-1", NOW, "UTC")
        assert response.fallback_used is True
        assert response.items, "the baseline must never be empty"
