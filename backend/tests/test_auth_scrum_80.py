import asyncio

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import text

from app.core.config import settings
from app.core.security import get_password_hash
from app.db import engine
from app.main import app


client = TestClient(app)


AUTH_TABLES_SQL = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        role TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS doctor_patients (
        id TEXT PRIMARY KEY,
        "doctorId" TEXT NOT NULL,
        "patientId" TEXT NOT NULL
    )
    """,
]


async def _reset_auth_tables() -> None:
    async with engine.begin() as conn:
        for statement in AUTH_TABLES_SQL:
            await conn.execute(text(statement))
        for table in ("doctor_patients", "doctors", "patients", "users"):
            await conn.execute(text(f"DELETE FROM {table}"))


async def _insert_user(
    *,
    user_id: str,
    email: str,
    password: str = "CorrectHorse2026!",
    role: str = "PATIENT",
    patient_id: str | None = None,
    doctor_id: str | None = None,
    assigned_patient_ids: list[str] | None = None,
) -> None:
    password_hash = get_password_hash(password)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                INSERT INTO users (id, email, password, role)
                VALUES (:id, :email, :password, :role)
                """
            ),
            {
                "id": user_id,
                "email": email,
                "password": password_hash,
                "role": role,
            },
        )
        if patient_id:
            await conn.execute(
                text(
                    """
                    INSERT INTO patients (id, "userId")
                    VALUES (:id, :user_id)
                    """
                ),
                {"id": patient_id, "user_id": user_id},
            )
        if doctor_id:
            await conn.execute(
                text(
                    """
                    INSERT INTO doctors (id, "userId")
                    VALUES (:id, :user_id)
                    """
                ),
                {"id": doctor_id, "user_id": user_id},
            )
            for index, assigned_patient_id in enumerate(assigned_patient_ids or []):
                await conn.execute(
                    text(
                        """
                        INSERT INTO doctor_patients (id, "doctorId", "patientId")
                        VALUES (:id, :doctor_id, :patient_id)
                        """
                    ),
                    {
                        "id": f"assignment-{doctor_id}-{index}",
                        "doctor_id": doctor_id,
                        "patient_id": assigned_patient_id,
                    },
                )


def _decode(access_token: str) -> dict:
    return jwt.decode(
        access_token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )


def test_login_verifies_email_and_password():
    asyncio.run(_reset_auth_tables())
    asyncio.run(
        _insert_user(
            user_id="user-patient-1",
            email="patient@example.com",
            password="CorrectHorse2026!",
            role="PATIENT",
            patient_id="patient-db-1",
        )
    )

    bad_password = client.post(
        "/api/v1/auth/login",
        json={"email": "patient@example.com", "password": "wrong"},
    )
    assert bad_password.status_code == 401

    unknown_email = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "CorrectHorse2026!"},
    )
    assert unknown_email.status_code == 401

    authenticated = client.post(
        "/api/v1/auth/login",
        json={"email": "patient@example.com", "password": "CorrectHorse2026!"},
    )
    assert authenticated.status_code == 200
    assert authenticated.json()["token_type"] == "bearer"


def test_patient_token_claims_come_from_db_not_request_body():
    asyncio.run(_reset_auth_tables())
    asyncio.run(
        _insert_user(
            user_id="user-patient-2",
            email="patient2@example.com",
            password="CorrectHorse2026!",
            role="PATIENT",
            patient_id="patient-db-2",
        )
    )

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "patient2@example.com",
            "password": "CorrectHorse2026!",
            "role": "ADMIN",
            "patient_id": "patient-forged",
            "doctor_id": "doctor-forged",
            "assigned_patient_ids": ["patient-forged"],
        },
    )

    assert response.status_code == 200
    payload = _decode(response.json()["access_token"])
    assert payload["sub"] == "user-patient-2"
    assert payload["role"] == "PATIENT"
    assert payload["patient_id"] == "patient-db-2"
    assert payload.get("doctor_id") is None
    assert payload.get("assigned_patient_ids") == []


def test_doctor_token_assignments_come_from_db_not_request_body():
    asyncio.run(_reset_auth_tables())
    asyncio.run(
        _insert_user(
            user_id="doctor-user-1",
            email="doctor@example.com",
            password="CorrectHorse2026!",
            role="DOCTOR",
            doctor_id="doctor-db-1",
            assigned_patient_ids=["patient-assigned-1", "patient-assigned-2"],
        )
    )

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "doctor@example.com",
            "password": "CorrectHorse2026!",
            "assigned_patient_ids": ["patient-forged"],
        },
    )

    assert response.status_code == 200
    payload = _decode(response.json()["access_token"])
    assert payload["sub"] == "doctor-user-1"
    assert payload["role"] == "DOCTOR"
    assert payload.get("patient_id") is None
    assert payload["doctor_id"] == "doctor-db-1"
    assert set(payload["assigned_patient_ids"]) == {
        "patient-assigned-1",
        "patient-assigned-2",
    }


def test_secret_key_validation_rules():
    from app.core.config import validate_secret_key

    for unsafe in ("", "super-secret-key-change-in-production", "short"):
        with pytest.raises(ValueError):
            validate_secret_key(unsafe, production=True)

    validate_secret_key("test-secret", production=False)
    validate_secret_key("a" * 32, production=True)


def test_protected_endpoint_accepts_db_backed_token_and_rejects_invalid_token():
    asyncio.run(_reset_auth_tables())
    asyncio.run(
        _insert_user(
            user_id="user-patient-3",
            email="patient3@example.com",
            password="CorrectHorse2026!",
            role="PATIENT",
            patient_id="patient-db-3",
        )
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "patient3@example.com", "password": "CorrectHorse2026!"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    accepted = client.post(
        "/api/v1/encounters",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert accepted.status_code == 201
    assert accepted.json()["user_id"] == "user-patient-3"

    rejected = client.post(
        "/api/v1/encounters",
        json={},
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert rejected.status_code == 401
