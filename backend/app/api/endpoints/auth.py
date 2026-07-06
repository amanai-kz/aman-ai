"""
Authentication endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUserContext, get_current_user_context
from app.core.auth_repository import AuthUserRecord, load_auth_user_by_email
from app.core.security import create_access_token
from app.core.security import verify_password
from app.db import get_session

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Login with email and password.
    Returns JWT access token.
    """
    user = await load_auth_user_by_email(session, data.email)
    if not user or not user.password_hash:
        raise _invalid_credentials()
    if not verify_password(data.password, user.password_hash):
        raise _invalid_credentials()

    return TokenResponse(access_token=_issue_token(user), token_type="bearer")


def _invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )


def _issue_token(user: AuthUserRecord) -> str:
    return create_access_token(
        user.user_id,
        extra_claims={
            "role": user.role,
            "patient_id": user.patient_id,
            "doctor_id": user.doctor_id,
            "assigned_patient_ids": user.assigned_patient_ids,
        },
    )


@router.post("/register", response_model=UserResponse)
async def register(data: RegisterRequest):
    """
    Register new user.
    """
    # TODO: Implement actual registration with database
    return UserResponse(
        id="mock_id",
        name=data.name,
        email=data.email,
    )


@router.post("/logout")
async def logout():
    """Logout current user"""
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: CurrentUserContext = Depends(get_current_user_context),
):
    """Get current authenticated user"""
    return UserResponse(
        id=current_user.user_id,
        name=current_user.user_id,
        email=current_user.user_id,
    )
