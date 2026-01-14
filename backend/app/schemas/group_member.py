"""
Schemas for group member operations.
"""
from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class GroupMemberResponse(BaseModel):
    """Response schema for group member with user details."""
    group_id: str
    user_id: str
    role: str
    joined_at: datetime
    user_email: Optional[str] = None
    user_display_name: Optional[str] = None

    class Config:
        from_attributes = True


class GroupMemberRoleUpdate(BaseModel):
    """Schema for updating a member's role."""
    role: str  # 'admin' or 'editor' (cannot assign 'owner')


class GroupInviteCreate(BaseModel):
    """Schema for creating a group invite (optional email)."""
    email: Optional[str] = None



class GroupInviteResponse(BaseModel):
    """Response schema for group invite."""
    token: str
    group_id: str
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True
