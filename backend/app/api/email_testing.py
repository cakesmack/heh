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


def get_featured_events(session: Session, limit: int = 3) -> list:
    """
    Get featured events with auto-fill logic.
    1. First get paid featured events
    2. Fill remaining slots with high-popularity events
    Returns exactly `limit` events.
    """
    from app.models.venue import Venue
    from app.models.bookmark import Bookmark
    from sqlmodel import func
    
    now = datetime.utcnow()
    featured = []
    
    # Step 1: Get paid featured events
    paid_events = session.exec(
        select(Event)
        .where(Event.featured == True)
        .where(Event.status == "published")
        .where(Event.date_start >= now)
        .where(Event.parent_event_id == None)
        .order_by(Event.date_start)
        .limit(limit)
    ).all()
    featured.extend(paid_events)
    
    # Step 2: If we need more, fill with popular events (most bookmarked)
    if len(featured) < limit:
        remaining = limit - len(featured)
        existing_ids = [e.id for e in featured]
        
        # Get events with most bookmarks
        popular_query = (
            select(Event)
            .where(Event.status == "published")
            .where(Event.date_start >= now)
            .where(Event.parent_event_id == None)
        )
        if existing_ids:
            popular_query = popular_query.where(Event.id.notin_(existing_ids))
        
        popular_events = session.exec(
            popular_query.order_by(desc(Event.date_start)).limit(remaining)
        ).all()
        featured.extend(popular_events)
    
    return featured[:limit]


def format_uuid(hex_id: str) -> str:
    """Format a 32-char hex ID as a UUID with hyphens."""
    if not hex_id or len(hex_id) != 32:
        return hex_id
    return f"{hex_id[:8]}-{hex_id[8:12]}-{hex_id[12:16]}-{hex_id[16:20]}-{hex_id[20:]}"


def format_event_data(event, session) -> dict:
    """Format an event for email template."""
    from app.models.venue import Venue
    
    venue_name = None
    if event.venue_id:
        venue = session.get(Venue, event.venue_id)
        venue_name = venue.name if venue else None
    
    # Format event ID as UUID for URL
    event_id = format_uuid(event.id) if event.id else ""
    
    return {
        "id": event_id,
        "title": event.title,
        "date_display": event.date_start.strftime("%a %d %b, %H:%M") if event.date_start else "",
        "venue_name": venue_name or event.location_name or "Various Locations",
        "image_url": event.image_url or None
    }


def capitalize_name(name: str) -> str:
    """Capitalize first letter of each word in name."""
    if not name:
        return "there"
    return " ".join(word.capitalize() for word in name.split())


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
    Send test welcome email with featured events (auto-fill) and trending events.
    """
    now = datetime.utcnow()
    
    # Get 3 featured events (paid or auto-filled)
    featured_events = get_featured_events(session, limit=3)
    featured_data = [format_event_data(e, session) for e in featured_events]
    
    # Get 4 trending events (exclude featured)
    featured_ids = [e.id for e in featured_events]
    trending_query = (
        select(Event)
        .where(Event.status == "published")
        .where(Event.date_start >= now)
        .where(Event.parent_event_id == None)
    )
    if featured_ids:
        trending_query = trending_query.where(Event.id.notin_(featured_ids))
    
    trending_events = session.exec(
        trending_query.order_by(Event.date_start).limit(4)
    ).all()
    trending_data = [format_event_data(e, session) for e in trending_events]
    
    # Capitalize user name
    username = capitalize_name(request.mock_user_name)
    
    # Send email with new template
    success = resend_email_service.send_welcome_with_events(
        to_email=request.recipient_email,
        username=username,
        featured_events=featured_data,
        trending_events=trending_data
    )

    return EmailTestResponse(
        success=success,
        message=f"Welcome email sent to {request.recipient_email}" if success else "Failed to send email",
        events_count=len(featured_data) + len(trending_data)
    )


@router.post("/weekly-digest", response_model=EmailTestResponse)
def test_weekly_digest(
    request: WeeklyDigestTestRequest,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Send test weekly digest with featured events + personalized matches.
    """
    from app.models.user_category_follow import UserCategoryFollow
    from app.models.user_preferences import UserPreferences
    from sqlalchemy import or_
    
    # Fetch the user to simulate
    target_user = session.get(User, request.simulate_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.utcnow()
    
    # Get 3 featured events (paid or auto-filled)
    featured_events = get_featured_events(session, limit=3)
    featured_data = [format_event_data(e, session) for e in featured_events]
    featured_ids = [e.id for e in featured_events]
    
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

    # Get personalized events based on follows (exclude featured)
    personalized_data = []
    if followed_venue_ids or followed_group_ids or followed_category_ids:
        conditions = []
        if followed_venue_ids:
            conditions.append(Event.venue_id.in_(followed_venue_ids))
        if followed_group_ids:
            conditions.append(Event.organizer_profile_id.in_(followed_group_ids))
        if followed_category_ids:
            conditions.append(Event.category_id.in_(followed_category_ids))
        
        personalized_query = (
            select(Event)
            .where(or_(*conditions))
            .where(Event.status == "published")
            .where(Event.date_start >= now)
            .where(Event.parent_event_id == None)
        )
        if featured_ids:
            personalized_query = personalized_query.where(Event.id.notin_(featured_ids))
        
        personalized_events = session.exec(
            personalized_query.order_by(Event.date_start).limit(6)
        ).all()
        personalized_data = [format_event_data(e, session) for e in personalized_events]

    # Get unsubscribe token
    prefs = session.exec(
        select(UserPreferences).where(UserPreferences.user_id == request.simulate_user_id)
    ).first()
    unsubscribe_token = prefs.unsubscribe_token if prefs else "test-token"
    
    # Capitalize user name
    username = capitalize_name(target_user.username or target_user.email.split('@')[0])

    # Send digest email with featured + personalized
    success = resend_email_service.send_weekly_digest(
        to_email=request.send_to_email,
        username=username,
        featured_events=featured_data,
        personalized_events=personalized_data,
        unsubscribe_token=unsubscribe_token
    )

    return EmailTestResponse(
        success=success,
        message=f"Weekly digest sent to {request.send_to_email} (simulating {target_user.username or target_user.email})" if success else "Failed to send email",
        events_count=len(featured_data) + len(personalized_data)
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
