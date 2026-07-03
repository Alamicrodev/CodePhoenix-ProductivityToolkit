import pytest

from tests.factories import API, focus_item_payload, focus_session_payload


def create_session(client, headers, **overrides):
    response = client.post(
        f"{API}/focus-sessions", json=focus_session_payload(**overrides), headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_list_sessions_initially_empty(client, auth_headers):
    response = client.get(f"{API}/focus-sessions", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_create_session_with_items(client, auth_headers):
    body = create_session(client, auth_headers, items=[focus_item_payload()])
    assert body["title"] == "Deep work"
    assert body["status"] == "active"
    assert body["elapsed_seconds"] == 0
    assert body["phase_type"] == "focus"
    assert body["completed"] is False
    assert body["completed_focus_blocks"] == 0
    assert body["completion_result"] is None
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["id"]
    assert item["source_type"] == "task"
    assert item["completed_in_session_at"] is None


def test_create_session_minimal_uses_defaults(client, auth_headers):
    response = client.post(
        f"{API}/focus-sessions",
        json={
            "title": "Minimal",
            "total_duration_minutes": 30,
            "focus_length_minutes": 25,
            "break_length_minutes": 5,
            "phase_remaining_seconds": 1500,
            "started_at": "2026-07-02T08:00:00Z",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "paused"
    assert body["phase_type"] == "focus"
    assert body["items"] == []


def test_create_session_zero_duration_rejected(client, auth_headers):
    response = client.post(
        f"{API}/focus-sessions",
        json=focus_session_payload(total_duration_minutes=0),
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_create_session_invalid_phase_rejected(client, auth_headers):
    response = client.post(
        f"{API}/focus-sessions", json=focus_session_payload(phase_type="nap"), headers=auth_headers
    )
    assert response.status_code == 422


def test_patch_session_updates_only_sent_fields(client, auth_headers):
    session = create_session(client, auth_headers)
    response = client.patch(
        f"{API}/focus-sessions/{session['id']}",
        json={"elapsed_seconds": 300, "completed_focus_blocks": 1},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["elapsed_seconds"] == 300
    assert body["completed_focus_blocks"] == 1
    assert body["title"] == session["title"]
    assert body["status"] == session["status"]


@pytest.mark.parametrize(
    "action,expected_status",
    [("pause", "paused"), ("resume", "active"), ("complete", "completed"), ("quit", "quit")],
)
def test_session_actions_set_status(client, auth_headers, action, expected_status):
    session = create_session(client, auth_headers)
    response = client.post(
        f"{API}/focus-sessions/{session['id']}/{action}", json={}, headers=auth_headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == expected_status


def test_pause_then_resume_toggles_paused_at(client, auth_headers):
    session = create_session(client, auth_headers)
    paused = client.post(
        f"{API}/focus-sessions/{session['id']}/pause", json={}, headers=auth_headers
    ).json()
    assert paused["paused_at"] is not None
    resumed = client.post(
        f"{API}/focus-sessions/{session['id']}/resume", json={}, headers=auth_headers
    ).json()
    assert resumed["paused_at"] is None
    assert resumed["status"] == "active"


def test_complete_action_marks_completed_and_sets_ended_at(client, auth_headers):
    session = create_session(client, auth_headers)
    response = client.post(
        f"{API}/focus-sessions/{session['id']}/complete", json={}, headers=auth_headers
    )
    body = response.json()
    assert body["completed"] is True
    assert body["ended_at"] is not None


def test_unsupported_action_rejected(client, auth_headers):
    session = create_session(client, auth_headers)
    response = client.post(
        f"{API}/focus-sessions/{session['id']}/bogusaction", json={}, headers=auth_headers
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported action"


def test_complete_session_item(client, auth_headers):
    session = create_session(client, auth_headers, items=[focus_item_payload()])
    item_id = session["items"][0]["id"]
    response = client.post(
        f"{API}/focus-sessions/{session['id']}/items/{item_id}/complete",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["items"][0]["completed_in_session_at"] is not None


def test_complete_unknown_item_returns_404(client, auth_headers):
    session = create_session(client, auth_headers)
    response = client.post(
        f"{API}/focus-sessions/{session['id']}/items/nope/complete",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_delete_session(client, auth_headers):
    session = create_session(client, auth_headers)
    response = client.delete(f"{API}/focus-sessions/{session['id']}", headers=auth_headers)
    assert response.status_code == 204
    assert (
        client.get(f"{API}/focus-sessions/{session['id']}", headers=auth_headers).status_code
        == 404
    )


def test_missing_session_returns_404(client, auth_headers):
    assert client.get(f"{API}/focus-sessions/nope", headers=auth_headers).status_code == 404
    assert (
        client.post(
            f"{API}/focus-sessions/nope/pause", json={}, headers=auth_headers
        ).status_code
        == 404
    )
