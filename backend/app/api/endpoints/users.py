"""
User management endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.auth import (
    CurrentUserContext,
    get_current_user_context,
    require_admin,
    require_user_access,
)

router = APIRouter()


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str = "user"


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None


@router.get("", response_model=List[UserResponse])
async def get_users(
    current_user: CurrentUserContext = Depends(get_current_user_context),
):
    """Get all users (admin only)"""
    require_admin(current_user)
    # TODO: Implement with database
    return []


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: CurrentUserContext = Depends(get_current_user_context),
):
    """Get user by ID"""
    require_user_access(user_id, current_user)
    # TODO: Implement with database
    raise HTTPException(status_code=404, detail="User not found")


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: CurrentUserContext = Depends(get_current_user_context),
):
    """Update user"""
    require_user_access(user_id, current_user)
    # TODO: Implement with database
    raise HTTPException(status_code=404, detail="User not found")


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: CurrentUserContext = Depends(get_current_user_context),
):
    """Delete user"""
    require_admin(current_user)
    # TODO: Implement with database
    return {"message": "User deleted"}

