"""
Authentication endpoints
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from app.core.auth import CurrentUserContext, get_current_user_context
from app.core.security import create_access_token

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
async def login(data: LoginRequest):
    """
    Login with email and password.
    Returns JWT access token.
    """
    return TokenResponse(
        access_token=create_access_token(
            data.email,
            extra_claims={
                "role": "PATIENT",
                "patient_id": data.email,
            },
        ),
        token_type="bearer",
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

