from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def auth_headers(
    user_id: str,
    role: str,
    *,
    patient_id: str | None = None,
    doctor_id: str | None = None,
    assigned_patient_ids: str | None = None,
) -> dict[str, str]:
    headers = {
        "X-Test-User-Id": user_id,
        "X-Test-Role": role,
    }
    if patient_id:
        headers["X-Test-Patient-Id"] = patient_id
    if doctor_id:
        headers["X-Test-Doctor-Id"] = doctor_id
    if assigned_patient_ids:
        headers["X-Test-Assigned-Patient-Ids"] = assigned_patient_ids
    return headers


def test_encounters_require_auth_and_ignore_forged_user_id():
    unauthenticated = client.post("/api/v1/encounters", json={})
    assert unauthenticated.status_code == 401

    forged = client.post(
        "/api/v1/encounters?user_id=victim",
        json={},
        headers={"X-User-Id": "victim"},
    )
    assert forged.status_code == 401


def test_forged_encounter_user_id_cannot_control_other_user_encounter():
    created = client.post(
        "/api/v1/encounters",
        json={},
        headers=auth_headers("owner-user", "PATIENT", patient_id="patient-owner"),
    )
    assert created.status_code == 201
    encounter_id = created.json()["id"]

    forged = client.post(
        f"/api/v1/encounters/{encounter_id}/pause?user_id=owner-user",
        json={},
        headers={
            **auth_headers("attacker-user", "PATIENT", patient_id="patient-attacker"),
            "X-User-Id": "owner-user",
        },
    )
    assert forged.status_code == 403


def test_user_routes_require_auth_and_delete_is_admin_only():
    assert client.get("/api/v1/users/some-user").status_code == 401
    assert client.patch("/api/v1/users/some-user", json={"name": "A"}).status_code == 401
    assert client.delete("/api/v1/users/some-user").status_code == 401

    patient_delete = client.delete(
        "/api/v1/users/some-user",
        headers=auth_headers("some-user", "PATIENT", patient_id="patient-1"),
    )
    assert patient_delete.status_code == 403

    admin_delete = client.delete(
        "/api/v1/users/some-user",
        headers=auth_headers("admin-user", "ADMIN"),
    )
    assert admin_delete.status_code == 200


def test_patient_data_route_groups_require_auth():
    paths = [
        "/api/v1/services/ct-mri/history",
        "/api/v1/services/blood/markers",
        "/api/v1/services/genetics/history",
        "/api/v1/services/questionnaire/list",
        "/api/v1/services/iot/stress/analysis",
        "/api/v1/services/rehabilitation/progress",
    ]

    for path in paths:
        assert client.get(path).status_code == 401


def test_patient_access_rules_on_blood_profile_save():
    payload = {"patient_id": "patient-2", "markers": {"wbc": {"value": 5.0}}}

    patient_forbidden = client.post(
        "/api/v1/services/blood/save-to-profile",
        json=payload,
        headers=auth_headers("patient-user-1", "PATIENT", patient_id="patient-1"),
    )
    assert patient_forbidden.status_code == 403

    doctor_forbidden = client.post(
        "/api/v1/services/blood/save-to-profile",
        json=payload,
        headers=auth_headers("doctor-user-1", "DOCTOR", doctor_id="doctor-1"),
    )
    assert doctor_forbidden.status_code == 403

    doctor_allowed = client.post(
        "/api/v1/services/blood/save-to-profile",
        json=payload,
        headers=auth_headers(
            "doctor-user-1",
            "DOCTOR",
            doctor_id="doctor-1",
            assigned_patient_ids="patient-2",
        ),
    )
    assert doctor_allowed.status_code == 200

    admin_allowed = client.post(
        "/api/v1/services/blood/save-to-profile",
        json=payload,
        headers=auth_headers("admin-user", "ADMIN"),
    )
    assert admin_allowed.status_code == 200
