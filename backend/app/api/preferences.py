"""
User Preferences API routes.
Handles email notification settings and category interests.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.user_preferences import UserPreferences

router = APIRouter(prefix="/users/me/preferences", tags=["Preferences"])
public_router = APIRouter(prefix="/preferences", tags=["Preferences"])


class PreferencesResponse(BaseModel):
    """Response schema for user preferences."""
    receives_email_updates: bool
    preferred_categories: List[str]


class PreferencesUpdate(BaseModel):
    """Request schema for updating preferences."""
    receives_email_updates: Optional[bool] = None
    preferred_categories: Optional[List[str]] = None


@router.get("", response_model=PreferencesResponse)
def get_preferences(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user's notification preferences."""
    preferences = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    ).first()

    # Create preferences if they don't exist (for existing users)
    if not preferences:
        preferences = UserPreferences(user_id=current_user.id)
        session.add(preferences)
        session.commit()
        session.refresh(preferences)

    return PreferencesResponse(
        receives_email_updates=preferences.receives_email_updates,
        preferred_categories=preferences.preferred_categories or []
    )


@router.patch("", response_model=PreferencesResponse)
def update_preferences(
    updates: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update current user's notification preferences."""
    preferences = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    ).first()

    # Create if doesn't exist
    if not preferences:
        preferences = UserPreferences(user_id=current_user.id)
        session.add(preferences)

    # Apply updates
    if updates.receives_email_updates is not None:
        preferences.receives_email_updates = updates.receives_email_updates
    if updates.preferred_categories is not None:
        preferences.preferred_categories = updates.preferred_categories

    preferences.updated_at = datetime.utcnow()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    return PreferencesResponse(
        receives_email_updates=preferences.receives_email_updates,
        preferred_categories=preferences.preferred_categories or []
    )


@public_router.get("/unsubscribe/{token}")
def unsubscribe_public(
    token: str,
    session: Session = Depends(get_session)
):
    """
    One-click unsubscribe using a public token.
    No authentication required.
    """
    # Find preferences by token
    preferences = session.exec(
        select(UserPreferences).where(UserPreferences.unsubscribe_token == token)
    ).first()

    if not preferences:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unsubscribe token not found"
        )

    # Simple one-click opt-out
    preferences.receives_email_updates = False
    preferences.updated_at = datetime.utcnow()

    session.add(preferences)
    session.commit()

    return {"message": "You have been successfully unsubscribed from News & Updates."}
