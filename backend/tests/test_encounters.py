from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _headers(user_id: str) -> dict[str, str]:
    return {"X-User-Id": user_id}


def _start_encounter(user_id: str = "user-1", state: dict | None = None) -> dict:
    payload = {"state": state} if state else {}
    response = client.post(
        "/api/v1/encounters",
        json=payload,
        headers=_headers(user_id),
    )
    assert response.status_code == 201
    return response.json()


def test_pause_active_encounter_sets_status_and_timestamp():
    encounter = _start_encounter()

    response = client.post(
        f"/api/v1/encounters/{encounter['id']}/pause",
        json={"state": {"flow_step": "intake"}},
        headers=_headers("user-1"),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paused"
    assert data["paused_at"] is not None
    assert data["last_activity_at"] is not None
    assert data["state"]["flow_step"] == "intake"


def test_pause_twice_or_after_completion_is_rejected():
    encounter = _start_encounter()

    first_pause = client.post(
        f"/api/v1/encounters/{encounter['id']}/pause",
        json={"state": {"flow_step": "first"}},
        headers=_headers("user-1"),
    )
    assert first_pause.status_code == 200

    second_pause = client.post(
        f"/api/v1/encounters/{encounter['id']}/pause",
        json={"state": {"flow_step": "second"}},
        headers=_headers("user-1"),
    )
    assert second_pause.status_code == 409

    complete = client.post(
        f"/api/v1/encounters/{encounter['id']}/complete",
        headers=_headers("user-1"),
    )
    assert complete.status_code == 200

    pause_after_complete = client.post(
        f"/api/v1/encounters/{encounter['id']}/pause",
        json={},
        headers=_headers("user-1"),
    )
    assert pause_after_complete.status_code == 409


def test_resume_paused_encounter_sets_status_and_resumed_at():
    encounter = _start_encounter()

    pause_response = client.post(
        f"/api/v1/encounters/{encounter['id']}/pause",
        json={},
        headers=_headers("user-1"),
    )
    assert pause_response.status_code == 200

    resume_response = client.post(
        f"/api/v1/encounters/{encounter['id']}/resume",
        headers=_headers("user-1"),
    )

    assert resume_response.status_code == 200
    data = resume_response.json()
    assert data["status"] == "active"
    assert data["resumed_at"] is not None
    assert data["last_activity_at"] is not None


def test_resume_from_active_or_completed_is_conflict():
    encounter = _start_encounter()

    resume_active = client.post(
        f"/api/v1/encounters/{encounter['id']}/resume",
        headers=_headers("user-1"),
    )
    assert resume_active.status_code == 409

    client.post(
        f"/api/v1/encounters/{encounter['id']}/complete",
        headers=_headers("user-1"),
    )

    resume_completed = client.post(
        f"/api/v1/encounters/{encounter['id']}/resume",
        headers=_headers("user-1"),
    )
    assert resume_completed.status_code == 409


def test_user_cannot_control_other_users_encounter():
    encounter = _start_encounter(user_id="owner-user")

    pause_attempt = client.post(
        f"/api/v1/encounters/{encounter['id']}/pause",
        json={},
        headers=_headers("other-user"),
    )
    assert pause_attempt.status_code == 403

    resume_attempt = client.post(
        f"/api/v1/encounters/{encounter['id']}/resume",
        headers=_headers("other-user"),
    )
    assert resume_attempt.status_code == 403


def test_state_persists_through_pause_and_resume():
    encounter = _start_encounter(state={"flow_step": "intro"})

    add_first_message = client.post(
        f"/api/v1/encounters/{encounter['id']}/messages",
        json={
            "content": "Hello",
            "role": "user",
            "flow_step": "question-1",
            "context": {"symptom": "fatigue"},
        },
        headers=_headers("user-1"),
    )
    assert add_first_message.status_code == 200

    add_second_message = client.post(
        f"/api/v1/encounters/{encounter['id']}/messages",
        json={
            "content": "Here is some advice",
            "role": "assistant",
            "flow_step": "question-2",
            "context": {"next_step": "follow-up"},
        },
        headers=_headers("user-1"),
    )
    assert add_second_message.status_code == 200

    pause_response = client.post(
        f"/api/v1/encounters/{encounter['id']}/pause",
        json={},
        headers=_headers("user-1"),
    )
    assert pause_response.status_code == 200

    resume_response = client.post(
        f"/api/v1/encounters/{encounter['id']}/resume",
        headers=_headers("user-1"),
    )
    assert resume_response.status_code == 200

    payload = resume_response.json()
    assert payload["state"]["flow_step"] == "question-2"
    assert payload["state"]["context"]["symptom"] == "fatigue"
    assert payload["state"]["context"]["next_step"] == "follow-up"
    assert len(payload["state"]["messages"]) == 2
