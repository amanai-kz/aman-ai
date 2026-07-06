"""
DB-backed auth lookup for Prisma-owned user/profile tables.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class AuthUserRecord:
    user_id: str
    email: str
    password_hash: str | None
    role: str
    patient_id: str | None = None
    doctor_id: str | None = None
    assigned_patient_ids: list[str] = field(default_factory=list)


async def load_auth_user_by_email(
    session: AsyncSession,
    email: str,
) -> AuthUserRecord | None:
    result = await session.execute(
        text(
            """
            SELECT id AS user_id, email, password AS password_hash, role
            FROM users
            WHERE email = :email
            LIMIT 1
            """
        ),
        {"email": email},
    )
    row = result.mappings().first()
    if not row:
        return None
    return await _hydrate_auth_user(session, row)


async def load_auth_user_by_id(
    session: AsyncSession,
    user_id: str,
) -> AuthUserRecord | None:
    result = await session.execute(
        text(
            """
            SELECT id AS user_id, email, password AS password_hash, role
            FROM users
            WHERE id = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    )
    row = result.mappings().first()
    if not row:
        return None
    return await _hydrate_auth_user(session, row)


async def _hydrate_auth_user(session: AsyncSession, row) -> AuthUserRecord:
    user_id = row["user_id"]
    patient_id = await _load_patient_id(session, user_id)
    doctor_id = await _load_doctor_id(session, user_id)
    assigned_patient_ids = (
        await _load_assigned_patient_ids(session, doctor_id) if doctor_id else []
    )
    return AuthUserRecord(
        user_id=user_id,
        email=row["email"],
        password_hash=row["password_hash"],
        role=row["role"],
        patient_id=patient_id,
        doctor_id=doctor_id,
        assigned_patient_ids=assigned_patient_ids,
    )


async def _load_patient_id(session: AsyncSession, user_id: str) -> str | None:
    result = await session.execute(
        text(
            """
            SELECT id
            FROM patients
            WHERE "userId" = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    )
    row = result.mappings().first()
    return row["id"] if row else None


async def _load_doctor_id(session: AsyncSession, user_id: str) -> str | None:
    result = await session.execute(
        text(
            """
            SELECT id
            FROM doctors
            WHERE "userId" = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    )
    row = result.mappings().first()
    return row["id"] if row else None


async def _load_assigned_patient_ids(
    session: AsyncSession,
    doctor_id: str,
) -> list[str]:
    result = await session.execute(
        text(
            """
            SELECT "patientId" AS patient_id
            FROM doctor_patients
            WHERE "doctorId" = :doctor_id
            ORDER BY "patientId"
            """
        ),
        {"doctor_id": doctor_id},
    )
    return [row["patient_id"] for row in result.mappings()]
