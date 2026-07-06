"""
Backend authentication and patient authorization helpers.
"""

from __future__ import annotations

from typing import Literal

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_repository import AuthUserRecord, load_auth_user_by_id
from app.core.config import settings
from app.db import get_session

Role = Literal["ADMIN", "DOCTOR", "PATIENT"]
VALID_ROLES: set[str] = {"ADMIN", "DOCTOR", "PATIENT"}


class CurrentUserContext(BaseModel):
    user_id: str
    role: Role
    patient_id: str | None = None
    doctor_id: str | None = None
    assigned_patient_ids: set[str] = Field(default_factory=set)


def _normalize_role(role: str | None) -> Role:
    normalized = (role or "").upper()
    if normalized not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid authenticated role required",
        )
    return normalized  # type: ignore[return-value]


def _split_ids(value: str | list[str] | None) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, list):
        return {item for item in value if item}
    return {item.strip() for item in value.split(",") if item.strip()}


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
        )
    return token


async def get_current_user_context(
    authorization: str | None = Header(default=None),
    x_test_user_id: str | None = Header(default=None),
    x_test_role: str | None = Header(default=None),
    x_test_patient_id: str | None = Header(default=None),
    x_test_doctor_id: str | None = Header(default=None),
    x_test_assigned_patient_ids: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> CurrentUserContext:
    """
    Resolve the authenticated backend user.

    Production uses a signed JWT. Tests/dev may opt into explicit X-Test-*
    headers with AMAN_AUTH_TEST_MODE=1. Legacy X-User-Id is intentionally not
    accepted as authentication.
    """
    token = _bearer_token(authorization)
    if token:
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            ) from exc
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token subject required",
            )
        user = await load_auth_user_by_id(session, str(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )
        return _context_from_auth_user(user)

    if settings.AMAN_AUTH_TEST_MODE and x_test_user_id:
        return CurrentUserContext(
            user_id=x_test_user_id,
            role=_normalize_role(x_test_role),
            patient_id=x_test_patient_id,
            doctor_id=x_test_doctor_id,
            assigned_patient_ids=_split_ids(x_test_assigned_patient_ids),
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )


def _context_from_auth_user(user: AuthUserRecord) -> CurrentUserContext:
    return CurrentUserContext(
        user_id=user.user_id,
        role=_normalize_role(user.role),
        patient_id=user.patient_id,
        doctor_id=user.doctor_id,
        assigned_patient_ids=set(user.assigned_patient_ids),
    )


def require_admin(current_user: CurrentUserContext) -> None:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


def require_user_access(user_id: str, current_user: CurrentUserContext) -> None:
    if current_user.role == "ADMIN" or current_user.user_id == user_id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized for this user",
    )


def require_patient_access(
    patient_id: str,
    current_user: CurrentUserContext,
) -> CurrentUserContext:
    if current_user.role == "ADMIN":
        return current_user
    if current_user.role == "PATIENT" and current_user.patient_id == patient_id:
        return current_user
    if current_user.role == "DOCTOR" and patient_id in current_user.assigned_patient_ids:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized for this patient",
    )


def require_patient_access_if_present(
    patient_id: str | None,
    current_user: CurrentUserContext,
) -> CurrentUserContext:
    if patient_id and patient_id != "unknown":
        return require_patient_access(patient_id, current_user)
    return current_user
