"""API tests for /ai-scheduler/suggest.

The route is a thin wrapper over build_ai_schedule, so these tests focus on
what only the full stack can prove: auth, request validation, that the
schedule is grounded in the caller's own persisted data, and that the Gemini
call is mocked at the service seam exactly like the TURN tests mock Cloudflare.
"""

from app.services import ai_scheduler as scheduler_service
from tests.factories import API, habit_payload, task_payload

# A fixed Wednesday morning keeps every relative label deterministic.
FIXED_NOW = "2026-07-22T09:30:00Z"


def suggest(client, headers, **overrides):
    payload = {"current_time": FIXED_NOW, "time_zone": "UTC"}
    payload.update(overrides)
    return client.post(f"{API}/ai-scheduler/suggest", json=payload, headers=headers)


def valid_item(**overrides):
    item = {"time": "9:00 AM", "title": "Deep work", "type": "task", "priority": "high", "duration": "45 min"}
    item.update(overrides)
    return item


class TestSuggestSchedule:
    def test_requires_authentication(self, client):
        response = client.post(f"{API}/ai-scheduler/suggest", json={})
        assert response.status_code == 401

    def test_rejects_malformed_timestamps(self, client, auth_headers):
        response = suggest(client, auth_headers, current_time="not-a-date")
        assert response.status_code == 422

    def test_fallback_schedule_is_grounded_in_own_data(self, client, monkeypatch, auth_headers):
        monkeypatch.setattr(scheduler_service.get_settings(), "gemini_api_key", "")

        task = client.post(f"{API}/tasks", json=task_payload(due_date="2026-07-22"), headers=auth_headers).json()
        habit = client.post(f"{API}/habits", json=habit_payload(), headers=auth_headers).json()

        response = suggest(client, auth_headers)

        assert response.status_code == 200
        body = response.json()
        assert body["fallback_used"] is True
        assert body["model"] == "heuristic-fallback"

        by_source = {item.get("source_id"): item for item in body["items"]}
        assert body["items"][0]["title"] == "Morning planning session"
        assert by_source[task["id"]]["title"] == task["title"]
        assert by_source[task["id"]]["detail"] == "Due today"
        assert by_source[habit["id"]]["type"] == "habit"
        # Tasks exist, so the day closes with the review block.
        assert body["items"][-1]["type"] == "review"

    def test_never_schedules_someone_elses_workspace(self, client, monkeypatch, auth_headers, other_auth_headers):
        monkeypatch.setattr(scheduler_service.get_settings(), "gemini_api_key", "")
        client.post(f"{API}/tasks", json=task_payload(title="Private task", due_date="2026-07-22"), headers=auth_headers)

        body = suggest(client, other_auth_headers).json()

        assert all(item["title"] != "Private task" for item in body["items"])

    def test_serves_model_output_when_gemini_answers(self, client, monkeypatch, auth_headers):
        settings = scheduler_service.get_settings()
        monkeypatch.setattr(settings, "gemini_api_key", "key-abc")
        task = client.post(f"{API}/tasks", json=task_payload(due_date="2026-07-22"), headers=auth_headers).json()
        captured = {}

        def fake_call(model, prompt, timeout_seconds, api_key):
            captured.update(model=model, prompt=prompt, timeout=timeout_seconds, api_key=api_key)
            return {"summary": "Report first.", "items": [valid_item(source_id=task["id"], source_type="task")]}

        monkeypatch.setattr(scheduler_service, "_call_gemini_scheduler", fake_call)

        body = suggest(client, auth_headers).json()

        assert body["fallback_used"] is False
        assert body["model"] == settings.scheduler_model
        assert body["summary"] == "Report first."
        assert [item["title"] for item in body["items"]] == ["Deep work"]
        # The prompt the model saw was built from the caller's persisted task.
        assert captured["model"] == settings.scheduler_model
        assert captured["api_key"] == "key-abc"
        assert captured["prompt"]["tasks"][0]["id"] == task["id"]

    def test_falls_back_when_gemini_is_down(self, client, monkeypatch, auth_headers):
        monkeypatch.setattr(scheduler_service.get_settings(), "gemini_api_key", "key-abc")
        monkeypatch.setattr(scheduler_service, "_call_gemini_scheduler", lambda *args, **kwargs: None)
        client.post(f"{API}/tasks", json=task_payload(due_date="2026-07-22"), headers=auth_headers)

        body = suggest(client, auth_headers).json()

        assert body["fallback_used"] is True
        assert body["items"], "an outage must still produce a plan"
        assert "unavailable" in body["summary"]

    def test_generated_at_lands_in_the_requested_timezone(self, client, monkeypatch, auth_headers):
        monkeypatch.setattr(scheduler_service.get_settings(), "gemini_api_key", "")

        body = suggest(client, auth_headers, current_time="2026-07-22T21:30:00Z", time_zone="Asia/Kolkata").json()

        # 21:30 UTC is 03:00 the next morning in Kolkata (+05:30).
        assert body["generated_at"].startswith("2026-07-23T03:00:00")
