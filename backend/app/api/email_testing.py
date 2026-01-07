"""
Admin Email Testing API - Test email templates with real data.
"""
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, desc

from app.core.database import get_session
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.models.event import Event
from app.models.follow import Follow
from app.services.resend_email import resend_email_service

router = APIRouter()


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
            "venue_name": venue_name or event.location_name or "Various Locations"
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
    """
    # Fetch the user to simulate
    target_user = session.get(User, request.simulate_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's follows (venues and organizers)
    follows = session.exec(
        select(Follow).where(Follow.follower_id == request.simulate_user_id)
    ).all()

    if not follows:
        return EmailTestResponse(
            success=False,
            message=f"User '{target_user.display_name or target_user.email}' follows 0 venues/organizers. No digest to generate.",
            events_count=0
        )

    followed_venue_ids = [f.target_id for f in follows if f.target_type == "venue"]
    followed_group_ids = [f.target_id for f in follows if f.target_type == "group"]

    # Query events in the next 7 days from followed venues/organizers
    now = datetime.utcnow()
    next_week = now + timedelta(days=7)

    events = session.exec(
        select(Event)
        .where(
            (Event.venue_id.in_(followed_venue_ids)) |
            (Event.organizer_profile_id.in_(followed_group_ids))
        )
        .where(Event.status == "published")
        .where(Event.date_start >= now)
        .where(Event.date_start <= next_week)
        .where(Event.parent_event_id == None)
        .order_by(Event.date_start)
        .limit(10)
    ).all()

    if not events:
        return EmailTestResponse(
            success=False,
            message=f"No matching events in next 7 days for user '{target_user.display_name or target_user.email}'.",
            events_count=0
        )

    # Format events for digest
    events_data = []
    for event in events:
        venue_name = None
        if event.venue_id:
            from app.models.venue import Venue
            venue = session.get(Venue, event.venue_id)
            venue_name = venue.name if venue else None
        
        events_data.append({
            "title": event.title,
            "date_display": event.date_start.strftime("%a %d %b, %H:%M") if event.date_start else "",
            "location": venue_name or event.location_name or "Various Locations"
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
