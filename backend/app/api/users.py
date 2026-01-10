"""
Users API routes.
Handles user profile and statistics.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from pydantic import BaseModel

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.event import Event
from app.models.checkin import CheckIn
from app.models.venue import Venue
from app.models.payment import Payment
from app.models.bookmark import Bookmark
from app.models.organizer import Organizer
from app.models.analytics import AnalyticsEvent
from app.schemas.user import UserUpdate, UserProfile
from app.core.security import hash_password

router = APIRouter(tags=["Users"])


class UserStatsResponse(BaseModel):
    """User statistics response."""
    user_id: str
    total_events: int
    upcoming_events: int
    past_events: int
    pending_events: int
    total_views: int
    total_saves: int
    total_ticket_clicks: int
    total_checkins: int


def get_user_stats(user_id: str, session: Session) -> UserStatsResponse:
    """Calculate user statistics aggregated by series."""
    now = datetime.utcnow()

    # Get all events owned by the user
    user_events = session.exec(
        select(Event).where(Event.organizer_id == user_id)
    ).all()

    # Group events by series
    series_map = {}
    for event in user_events:
        series_id = event.parent_event_id or event.id
        if series_id not in series_map:
            series_map[series_id] = []
        series_map[series_id].append(event)

    total_series = len(series_map)
    upcoming_series = 0
    past_series = 0
    pending_series = 0

    for series_id, events in series_map.items():
        is_upcoming = any(e.date_start >= now for e in events)
        is_pending = any(e.status == "pending" for e in events)
        is_past = all(e.date_end < now for e in events)

        if is_upcoming:
            upcoming_series += 1
        if is_pending:
            pending_series += 1
        if is_past:
            past_series += 1

    # Total check-ins
    total_checkins = session.exec(
        select(func.count(CheckIn.id)).where(CheckIn.user_id == user_id)
    ).one()

    # Analytics stats
    all_event_ids = [e.id for e in user_events]
    
    total_views = 0
    total_saves = 0
    total_ticket_clicks = 0

    if all_event_ids:
        # Normalize IDs for comparison with metadata
        normalized_ids = [eid.replace("-", "") for eid in all_event_ids]
        
        # This is a bit expensive, but for a single user's dashboard it should be okay
        # In a real production app, we'd have an aggregated stats table
        analytics = session.exec(
            select(AnalyticsEvent)
            .where(AnalyticsEvent.event_type.in_(["event_view", "save_event", "click_ticket"]))
        ).all()

        for ae in analytics:
            target_id = ae.event_metadata.get("target_id") if ae.event_metadata else None
            if target_id and target_id.replace("-", "") in normalized_ids:
                if ae.event_type == "event_view":
                    total_views += 1
                elif ae.event_type == "save_event":
                    total_saves += 1
                elif ae.event_type == "click_ticket":
                    total_ticket_clicks += 1

    return UserStatsResponse(
        user_id=user_id,
        total_events=total_series,
        upcoming_events=upcoming_series,
        past_events=past_series,
        pending_events=pending_series,
        total_views=total_views,
        total_saves=total_saves,
        total_ticket_clicks=total_ticket_clicks,
        total_checkins=total_checkins
    )


@router.get("/me/stats", response_model=UserStatsResponse)
def get_my_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user's event statistics."""
    return get_user_stats(current_user.id, session)


@router.put("/me", response_model=UserProfile)
def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update current user's profile.
    Allows updating email, username, display_name, and password.
    """
    # Refetch user from session to ensure it's tracked and avoid detached instance issues
    db_user = session.get(User, current_user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check username uniqueness if changing
    if user_update.username and user_update.username != db_user.username:
        existing_user = session.exec(
            select(User).where(User.username == user_update.username)
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        db_user.username = user_update.username

    # Check email uniqueness if changing
    if user_update.email and user_update.email != db_user.email:
        existing_user = session.exec(
            select(User).where(User.email == user_update.email)
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        db_user.email = user_update.email

    if user_update.display_name is not None:
        db_user.display_name = user_update.display_name

    if user_update.password:
        db_user.password_hash = hash_password(user_update.password)

    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    # Calculate stats for response
    total_checkins = len(db_user.check_ins)
    total_events_submitted = len(db_user.submitted_events)

    return UserProfile(
        id=db_user.id,
        email=db_user.email,
        username=db_user.username,
        display_name=db_user.display_name,
        is_admin=db_user.is_admin,
        created_at=db_user.created_at,
        total_checkins=total_checkins,
        total_events_submitted=total_events_submitted
    )


@router.get("/{user_id}/stats", response_model=UserStatsResponse)
def get_user_stats_by_id(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get a user's event statistics. Users can only view their own stats unless admin."""
    normalized_id = normalize_uuid(user_id)

    if normalized_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user's stats"
        )

    return get_user_stats(normalized_id, session)


# ============================================================
# NOTIFICATION SETTINGS
# ============================================================

class NotificationSettingsResponse(BaseModel):
    """User notification settings response."""
    receive_interest_notifications: bool


class NotificationSettingsUpdate(BaseModel):
    """Update notification settings."""
    receive_interest_notifications: bool = None


@router.get("/me/notification-settings", response_model=NotificationSettingsResponse)
def get_notification_settings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get current user's notification settings."""
    return NotificationSettingsResponse(
        receive_interest_notifications=current_user.receive_interest_notifications
    )


@router.put("/me/notification-settings", response_model=NotificationSettingsResponse)
def update_notification_settings(
    settings: NotificationSettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update current user's notification settings."""
    db_user = session.get(User, current_user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if settings.receive_interest_notifications is not None:
        db_user.receive_interest_notifications = settings.receive_interest_notifications
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    
    return NotificationSettingsResponse(
        receive_interest_notifications=db_user.receive_interest_notifications
    )

