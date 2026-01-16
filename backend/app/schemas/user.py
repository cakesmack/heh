"""
Pydantic schemas for user-related API requests and responses.
Handles authentication, registration, and user profiles.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    """Schema for basic user information."""
    id: UUID
    email: str
    username: str
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserProfile(BaseModel):
    """Schema for detailed user profile."""
    id: UUID
    email: str
    username: str
    is_admin: bool
    created_at: datetime
    total_checkins: int = 0
    total_events_submitted: int = 0

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=8, max_length=100)
