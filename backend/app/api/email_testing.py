"""
Admin Email Testing API - Test email templates with real data.
"""
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, desc

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.follow import Follow
from app.services.resend_email import resend_email_service

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires admin privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# Request schemas
class WelcomeTestRequest(BaseModel):
    recipient_email: EmailStr
    mock_user_name: str = "Test User"


class WeeklyDigestTestRequest(BaseModel):
    simulate_user_id: str
    send_to_email: EmailStr


class SystemAlertTestRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    message_body: str


# Response schemas
class EmailTestResponse(BaseModel):
    success: bool
    message: str
    events_count: int = 0


@router.post("/welcome", response_model=EmailTestResponse)
def test_welcome_email(
    request: WelcomeTestRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Send test welcome email with 6 upcoming events.
    """
    # Fetch 6 upcoming published events
    now = datetime.utcnow()
    events = session.exec(
        select(Event)
        .where(Event.status == "published")
        .where(Event.date_start >= now)
        .where(Event.parent_event_id == None)
        .order_by(Event.date_start)
        .limit(6)
    ).all()

    # Format events for email template
    events_data = []
    for event in events:
        venue_name = None
        if event.venue_id:
            from app.models.venue import Venue
            venue = session.get(Venue, event.venue_id)
            venue_name = venue.name if venue else None
        
        events_data.append({
            "id": event.id,
            "title": event.title,
            "date_display": event.date_start.strftime("%a %d %b, %H:%M") if event.date_start else "",
            "venue_name": venue_name or event.location_name or "Various Locations",
            "image_url": event.image_url or None
        })

    # Send email
    success = resend_email_service.send_welcome_with_events(
        to_email=request.recipient_email,
        display_name=request.mock_user_name,
        events=events_data
    )

    return EmailTestResponse(
        success=success,
        message=f"Welcome email sent to {request.recipient_email}" if success else "Failed to send email",
        events_count=len(events_data)
    )


@router.post("/weekly-digest", response_model=EmailTestResponse)
def test_weekly_digest(
    request: WeeklyDigestTestRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Send test weekly digest simulating a specific user's preferences.
    Matches 'My Feed' logic: events from followed venues, organizers, OR categories.
    """
    from app.models.user_category_follow import UserCategoryFollow
    from app.models.venue import Venue
    from sqlalchemy import or_
    
    # Fetch the user to simulate
    target_user = session.get(User, request.simulate_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's venue/organizer follows
    follows = session.exec(
        select(Follow).where(Follow.follower_id == request.simulate_user_id)
    ).all()
    
    # Get user's category follows
    category_follows = session.exec(
        select(UserCategoryFollow).where(UserCategoryFollow.user_id == request.simulate_user_id)
    ).all()

    followed_venue_ids = [f.target_id for f in follows if f.target_type == "venue"]
    followed_group_ids = [f.target_id for f in follows if f.target_type == "group"]
    followed_category_ids = [cf.category_id for cf in category_follows]

    # Check if user has any follows at all
    if not followed_venue_ids and not followed_group_ids and not followed_category_ids:
        return EmailTestResponse(
            success=False,
            message=f"User '{target_user.display_name or target_user.email}' has no follows. No digest to generate.",
            events_count=0
        )

    # Build OR conditions for matching events
    now = datetime.utcnow()
    conditions = []
    if followed_venue_ids:
        conditions.append(Event.venue_id.in_(followed_venue_ids))
    if followed_group_ids:
        conditions.append(Event.organizer_profile_id.in_(followed_group_ids))
    if followed_category_ids:
        conditions.append(Event.category_id.in_(followed_category_ids))

    # Query matching events (no 7-day limit for better testing)
    events = session.exec(
        select(Event)
        .where(or_(*conditions))
        .where(Event.status == "published")
        .where(Event.date_start >= now)
        .where(Event.parent_event_id == None)
        .order_by(Event.date_start)
        .limit(10)
    ).all()

    if not events:
        return EmailTestResponse(
            success=False,
            message=f"No upcoming events for user '{target_user.display_name or target_user.email}' (checked {len(followed_venue_ids)} venues, {len(followed_group_ids)} groups, {len(followed_category_ids)} categories).",
            events_count=0
        )

    # Format events for digest with images
    events_data = []
    for event in events:
        venue_name = None
        if event.venue_id:
            venue = session.get(Venue, event.venue_id)
            venue_name = venue.name if venue else None
        
        events_data.append({
            "id": event.id,
            "title": event.title,
            "date_display": event.date_start.strftime("%a %d %b, %H:%M") if event.date_start else "",
            "location": venue_name or event.location_name or "Various Locations",
            "image_url": event.image_url or None
        })

    # Get unsubscribe token from preferences
    from app.models.user_preferences import UserPreferences
    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == request.simulate_user_id)
    ).first()
    unsubscribe_token = prefs.unsubscribe_token if prefs else "test-token"

    # Send digest email to override address
    success = resend_email_service.send_weekly_digest(
        to_email=request.send_to_email,
        display_name=target_user.display_name or "there",
        events=events_data,
        unsubscribe_token=unsubscribe_token
    )

    return EmailTestResponse(
        success=success,
        message=f"Weekly digest sent to {request.send_to_email} (simulating {target_user.display_name or target_user.email})" if success else "Failed to send email",
        events_count=len(events_data)
    )


@router.post("/system-alert", response_model=EmailTestResponse)
def test_system_alert(
    request: SystemAlertTestRequest,
    current_user: User = Depends(require_admin),
):
    """
    Send test system alert email.
    """
    success = resend_email_service.send_system_alert(
        to_email=request.recipient_email,
        subject=request.subject,
        message_body=request.message_body
    )

    return EmailTestResponse(
        success=success,
        message=f"System alert sent to {request.recipient_email}" if success else "Failed to send email",
        events_count=0
    )
