from tests.factories import API, focus_session_payload, habit_payload, task_payload


def test_dashboard_empty_user_returns_zeroes(client, auth_headers):
    response = client.get(f"{API}/dashboard/summary", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {
        "total_tasks": 0,
        "completed_tasks": 0,
        "total_habits": 0,
        "active_focus_sessions": 0,
    }


def test_dashboard_counts_reflect_data(client, auth_headers):
    # two tasks, one completed
    first = client.post(f"{API}/tasks", json=task_payload(), headers=auth_headers).json()
    client.post(f"{API}/tasks", json=task_payload(title="Second"), headers=auth_headers)
    client.patch(f"{API}/tasks/{first['id']}", json={"completed": True}, headers=auth_headers)
    # one habit
    client.post(f"{API}/habits", json=habit_payload(), headers=auth_headers)
    # one active session and one completed via the lifecycle action
    client.post(f"{API}/focus-sessions", json=focus_session_payload(), headers=auth_headers)
    done = client.post(
        f"{API}/focus-sessions", json=focus_session_payload(title="Done"), headers=auth_headers
    ).json()
    client.post(f"{API}/focus-sessions/{done['id']}/complete", json={}, headers=auth_headers)

    response = client.get(f"{API}/dashboard/summary", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {
        "total_tasks": 2,
        "completed_tasks": 1,
        "total_habits": 1,
        "active_focus_sessions": 1,
    }
