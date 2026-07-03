"""Cross-user data isolation.

Every resource is scoped to the authenticated user; another user must not be
able to observe or mutate it. 404 (not 403) keeps resource ids from leaking.
"""

from tests.factories import API, focus_session_payload, habit_payload, task_payload


def _seed_user_a(client, auth_headers):
    task = client.post(f"{API}/tasks", json=task_payload(), headers=auth_headers).json()
    habit = client.post(f"{API}/habits", json=habit_payload(), headers=auth_headers).json()
    session = client.post(
        f"{API}/focus-sessions", json=focus_session_payload(), headers=auth_headers
    ).json()
    return task, habit, session


def test_users_cannot_list_each_others_data(client, auth_headers, other_auth_headers):
    _seed_user_a(client, auth_headers)
    for path in ("/tasks", "/habits", "/focus-sessions"):
        response = client.get(f"{API}{path}", headers=other_auth_headers)
        assert response.status_code == 200
        assert response.json() == [], path


def test_cross_user_reads_and_writes_return_404(client, auth_headers, other_auth_headers):
    task, habit, session = _seed_user_a(client, auth_headers)

    # reads
    assert client.get(f"{API}/tasks/{task['id']}", headers=other_auth_headers).status_code == 404
    assert client.get(f"{API}/habits/{habit['id']}", headers=other_auth_headers).status_code == 404
    assert (
        client.get(f"{API}/focus-sessions/{session['id']}", headers=other_auth_headers).status_code
        == 404
    )

    # writes
    assert (
        client.patch(
            f"{API}/tasks/{task['id']}", json={"title": "hijack"}, headers=other_auth_headers
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"{API}/habits/{habit['id']}/complete",
            json={"timestamp": "2026-07-02T09:00:00Z"},
            headers=other_auth_headers,
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"{API}/focus-sessions/{session['id']}/pause", json={}, headers=other_auth_headers
        ).status_code
        == 404
    )

    # deletes
    assert (
        client.delete(f"{API}/tasks/{task['id']}", headers=other_auth_headers).status_code == 404
    )
    assert (
        client.delete(f"{API}/habits/{habit['id']}", headers=other_auth_headers).status_code == 404
    )
    assert (
        client.delete(
            f"{API}/focus-sessions/{session['id']}", headers=other_auth_headers
        ).status_code
        == 404
    )

    # the owner still sees everything untouched
    assert client.get(f"{API}/tasks/{task['id']}", headers=auth_headers).status_code == 200
    assert client.get(f"{API}/habits/{habit['id']}", headers=auth_headers).status_code == 200
    assert (
        client.get(f"{API}/focus-sessions/{session['id']}", headers=auth_headers).status_code
        == 200
    )
