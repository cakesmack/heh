"""
Check-ins API routes.
Handles event check-ins with location/time validation.
"""
# Force reload
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.config import settings
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.checkin import CheckIn
from app.schemas.checkin import (
    CheckInRequest,
    CheckInResponse,
    CheckInHistory,
    CheckInStatsResponse
)
from app.utils.location_validation import (
    validate_checkin_location,
    is_within_time_window,
    is_night_checkin
)
from app.services.promotions import get_promotion_for_venue_checkin

router = APIRouter(tags=["Check-ins"])


@router.post("/events/{event_id}/checkin", response_model=CheckInResponse)
def checkin_to_event(
    event_id: str,
    checkin_data: CheckInRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Check in to an event.

    Validates:
    - Event exists
    - User location is within acceptable range (~100m)
    - Current time is within event window (±15 minutes)
    - User hasn't already checked in

    Potentially unlocks promotions.
    """
    # Get event (normalize UUID for SQLite)
    event_id_normalized = normalize_uuid(event_id)
    event = session.get(Event, event_id_normalized)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Check if user already checked in
    existing_checkin = session.exec(
        select(CheckIn)
        .where(CheckIn.user_id == current_user.id)
        .where(CheckIn.event_id == event_id_normalized)
    ).first()

    if existing_checkin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already checked in to this event"
        )

    # Validate location
    location_valid, distance = validate_checkin_location(
        event.latitude,
        event.longitude,
        checkin_data.latitude,
        checkin_data.longitude
    )

    if not location_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are too far from the event location. Distance: {distance:.0f}m (max {settings.CHECKIN_MAX_DISTANCE_METERS}m)"
        )

    # Validate time window
    checkin_time = checkin_data.device_time or datetime.utcnow()
    time_valid, time_message = is_within_time_window(
        event.date_start,
        event.date_end,
        checkin_time
    )

    if not time_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=time_message
        )

    # Check if this is first check-in at this venue
    is_first_at_venue = not session.exec(
        select(CheckIn)
        .join(Event)
        .where(CheckIn.user_id == current_user.id)
        .where(Event.venue_id == event.venue_id)
    ).first()

    # Check if night check-in
    is_night = is_night_checkin(checkin_time)

    # Create check-in record
    new_checkin = CheckIn(
        user_id=current_user.id,
        event_id=event_id_normalized,
        latitude=checkin_data.latitude,
        longitude=checkin_data.longitude,
        is_first_at_venue=is_first_at_venue,
        is_night_checkin=is_night,
        timestamp=checkin_time
    )

    session.add(new_checkin)
    session.commit()
    session.refresh(new_checkin)

    # Check for promotion unlock
    promotion = get_promotion_for_venue_checkin(
        session,
        event.venue_id,
        current_user.id
    )

    promotion_data = None
    if promotion:
        promotion_data = {
            "id": str(promotion.id),
            "title": promotion.title,
            "description": promotion.description,
            "discount_type": promotion.discount_type,
            "discount_value": promotion.discount_value
        }

    # Build response
    return CheckInResponse(
        success=True,
        message="Successfully checked in!",
        promotion_unlocked=promotion_data,
        checkin_id=new_checkin.id
    )


@router.get("/checkins/my", response_model=list[CheckInHistory])
def get_my_checkins(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get current user's check-in history.

    Returns list of check-ins with event and venue details.
    """
    # Get check-ins with joined event/venue data (normalize UUID for SQLite)
    user_id_normalized = normalize_uuid(current_user.id)
    checkins = session.exec(
        select(CheckIn)
        .where(CheckIn.user_id == user_id_normalized)
        .order_by(CheckIn.timestamp.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    # Build response with event/venue names
    history = []
    for checkin in checkins:
        event = session.get(Event, checkin.event_id)
        venue = session.get(Venue, event.venue_id) if event else None

        history_item = CheckInHistory(
            id=checkin.id,
            event_id=checkin.event_id,
            event_title=event.title if event else "Unknown Event",
            venue_name=venue.name if venue else "Unknown Venue",
            timestamp=checkin.timestamp,
            is_first_at_venue=checkin.is_first_at_venue,
            is_night_checkin=checkin.is_night_checkin
        )
        history.append(history_item)

    return history


@router.get("/events/{event_id}/checkins/count")
def get_event_checkin_count(
    event_id: str,
    session: Session = Depends(get_session)
):
    """
    Get total check-in count for an event.

    Public endpoint - no authentication required.
    """
    event_id_normalized = normalize_uuid(event_id)
    event = session.get(Event, event_id_normalized)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    count = session.exec(
        select(func.count(CheckIn.id)).where(CheckIn.event_id == event_id_normalized)
    ).one()

    return {"event_id": event_id_normalized, "checkin_count": count}


@router.get("/checkins/stats", response_model=CheckInStatsResponse)
def get_checkin_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get check-in statistics for current user.

    Returns aggregated stats about user's check-in activity.
    """
    # Total check-ins
    total_checkins = session.exec(
        select(func.count(CheckIn.id)).where(CheckIn.user_id == current_user.id)
    ).one()

    # Unique venues visited
    unique_venues = session.exec(
        select(func.count(func.distinct(Event.venue_id)))
        .select_from(CheckIn)
        .join(Event)
        .where(CheckIn.user_id == current_user.id)
    ).one()

    # First and last check-in
    first_checkin = session.exec(
        select(CheckIn.timestamp)
        .where(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.timestamp)
        .limit(1)
    ).first()

    last_checkin = session.exec(
        select(CheckIn.timestamp)
        .where(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.timestamp.desc())
        .limit(1)
    ).first()

    return CheckInStatsResponse(
        total_checkins=total_checkins,
        unique_venues=unique_venues,
        first_checkin=first_checkin,
        last_checkin=last_checkin
    )
