from tests.factories import API, task_payload


def create_task(client, headers, **overrides):
    response = client.post(f"{API}/tasks", json=task_payload(**overrides), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_list_tasks_initially_empty(client, auth_headers):
    response = client.get(f"{API}/tasks", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_create_task_returns_full_shape(client, auth_headers):
    body = create_task(client, auth_headers)
    assert body["title"] == "Write report"
    assert body["priority"] == "high"
    assert body["tags"] == ["work", "urgent"]
    assert body["quadrant"] == "urgent-important"
    assert body["completed"] is False
    assert body["id"] and body["created_at"] and body["updated_at"]
    assert len(body["subtasks"]) == 1
    assert body["subtasks"][0]["title"] == "Draft outline"
    assert body["subtasks"][0]["completed"] is False


def test_create_task_minimal_uses_defaults(client, auth_headers):
    response = client.post(f"{API}/tasks", json={"title": "Minimal"}, headers=auth_headers)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["description"] == ""
    assert body["priority"] == "medium"
    assert body["tags"] == []
    assert body["quadrant"] is None
    assert body["subtasks"] == []


def test_create_task_empty_title_rejected(client, auth_headers):
    response = client.post(f"{API}/tasks", json={"title": ""}, headers=auth_headers)
    assert response.status_code == 422


def test_create_task_invalid_priority_rejected(client, auth_headers):
    response = client.post(
        f"{API}/tasks", json=task_payload(priority="urgent"), headers=auth_headers
    )
    assert response.status_code == 422


def test_create_task_invalid_quadrant_rejected(client, auth_headers):
    response = client.post(
        f"{API}/tasks", json=task_payload(quadrant="top-left"), headers=auth_headers
    )
    assert response.status_code == 422


def test_get_task_by_id(client, auth_headers):
    task = create_task(client, auth_headers)
    response = client.get(f"{API}/tasks/{task['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == task["id"]


def test_list_returns_created_tasks(client, auth_headers):
    create_task(client, auth_headers)
    create_task(client, auth_headers, title="Second")
    response = client.get(f"{API}/tasks", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_patch_updates_only_sent_fields(client, auth_headers):
    task = create_task(client, auth_headers)
    response = client.patch(
        f"{API}/tasks/{task['id']}",
        json={"completed": True, "priority": "low"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["completed"] is True
    assert body["priority"] == "low"
    # untouched fields survive the partial update
    assert body["title"] == task["title"]
    assert body["tags"] == task["tags"]
    assert len(body["subtasks"]) == 1


def test_duration_defaults_to_none_and_round_trips(client, auth_headers):
    body = create_task(client, auth_headers)
    assert body["duration_minutes"] is None

    created = create_task(client, auth_headers, duration_minutes=45)
    assert created["duration_minutes"] == 45


def test_patch_sets_and_clears_duration(client, auth_headers):
    task = create_task(client, auth_headers, duration_minutes=30)
    response = client.patch(
        f"{API}/tasks/{task['id']}",
        json={"duration_minutes": 90},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["duration_minutes"] == 90

    response = client.patch(
        f"{API}/tasks/{task['id']}",
        json={"duration_minutes": None},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["duration_minutes"] is None


def test_create_task_invalid_duration_rejected(client, auth_headers):
    for bad in (0, -15, 24 * 60 + 1):
        response = client.post(
            f"{API}/tasks", json=task_payload(duration_minutes=bad), headers=auth_headers
        )
        assert response.status_code == 422, bad


def test_patch_replaces_subtasks_when_provided(client, auth_headers):
    task = create_task(client, auth_headers)
    response = client.patch(
        f"{API}/tasks/{task['id']}",
        json={"subtasks": [{"title": "Replacement"}, {"title": "Another"}]},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    titles = sorted(subtask["title"] for subtask in response.json()["subtasks"])
    assert titles == ["Another", "Replacement"]


def test_delete_task(client, auth_headers):
    task = create_task(client, auth_headers)
    response = client.delete(f"{API}/tasks/{task['id']}", headers=auth_headers)
    assert response.status_code == 204
    assert client.get(f"{API}/tasks/{task['id']}", headers=auth_headers).status_code == 404


def test_missing_task_returns_404(client, auth_headers):
    assert client.get(f"{API}/tasks/nope", headers=auth_headers).status_code == 404
    assert (
        client.patch(f"{API}/tasks/nope", json={"title": "x"}, headers=auth_headers).status_code
        == 404
    )
    assert client.delete(f"{API}/tasks/nope", headers=auth_headers).status_code == 404
