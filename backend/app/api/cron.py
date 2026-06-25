"""
Cron Job API Endpoints
"""
import os
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status, BackgroundTasks
from sqlmodel import Session, select, col
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.security import get_current_user_optional
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.models.event import Event
from app.models.venue import Venue
from app.models.featured_booking import FeaturedBooking, BookingStatus
from app.api.email_testing import get_featured_events, format_event_data
from app.services.resend_email import resend_email_service

router = APIRouter(prefix="/cron", tags=["Cron Jobs"])
logger = logging.getLogger(__name__)

CRON_SECRET = os.getenv("CRON_SECRET_KEY", "super-secret-cron-key")

def verify_cron_access(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Verify access via CRON_SECRET header OR Admin user.
    """
    # 1. Check Header (for external cron services like Vercel Cron, Render Cron)
    if x_cron_secret == CRON_SECRET:
        return True
    
    # 2. Check Admin User (for manual triggering from dashboard)
    if current_user and current_user.is_admin:
        return True
        
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized cron access"
    )

@router.post("/weekly-digest")
async def trigger_weekly_digest(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    authorized: bool = Depends(verify_cron_access)
):
    """
    Trigger the Weekly Digest email blast.
    
    Logic:
    1. Fetch global 'Featured' events (Top 3).
    2. Fetch 'Popular' events (Top 5) as fallback.
    3. Get all users with weekly_digest=True.
    4. For each user, find personalized matches (Category/Venue) in next 7 days.
       If < 1 match, use Popular events.
    5. Send email via Resend (background task).
    """
    logger.info("Starting Weekly Digest Cron Job")
    
    # 1. Get Global Content
    # We can reuse the helper logic but need to be careful with session
    # Using the helper from email_testing is the DRYest way
    
    # Featured Events (Top 3)
    featured_raw = get_featured_events(session, limit=3)
    featured_data = [format_event_data(e, session) for e in featured_raw]

    # Popular/Trending Events (Fallback - Top 5 next 7 days)
    now = datetime.utcnow()
    next_week = now + timedelta(days=7)

    popular_query = (
        select(Event)
        .where(Event.date_start >= now)
        .where(Event.date_start <= next_week)
        .where(Event.status == "published")
        .order_by(Event.date_start.asc())
        .limit(5)
    )
    # Safe fallback if no upcoming events found (widen search window)
    popular_raw = session.exec(popular_query).all()
    if not popular_raw:
         popular_query = (
            select(Event)
            .where(Event.date_start >= now)
            .where(Event.status == "published")
            .order_by(Event.date_start.asc())
            .limit(5)
        )
         popular_raw = session.exec(popular_query).all()

    popular_data = [format_event_data(e, session) for e in popular_raw]

    # 2. Get Subscribed Users
    # Join with UserPreferences to filter by weekly_digest=True
    user_query = (
        select(User)
        .join(UserPreferences)
        .where(UserPreferences.weekly_digest == True)
        .where(User.is_active == True)
        .options(selectinload(User.preferences))
    )
    subscribed_users = session.exec(user_query).all()

    sent_count = 0

    for user in subscribed_users:
        # 3. Personalization Loop
        user_prefs = user.preferences
        preferred_cats = user_prefs.preferred_categories if user_prefs else []

        # Find matches next 7 days
        # Match by Category OR Followed Venues (if we had that logic ready, for now Category is easier)
        # We need a query that filters by category IN preferred_cats

        personalized_data = []

        if preferred_cats:
            # Query events in these categories
            match_query = (
                select(Event)
                .join(Venue) # Join venue for location data access if needed
                .where(Event.date_start >= now)
                .where(Event.date_start <= next_week)
                .where(Event.status == "published")
                .where(col(Event.category_id).in_(preferred_cats))
                .limit(6)
            )
            matches = session.exec(match_query).all()
            personalized_data = [format_event_data(e, session) for e in matches]

        # Fallback if no matches or no preferences
        if not personalized_data:
            personalized_data = popular_data
            
        # 4. Send Email
        # We use background_tasks to not block the cron response, 
        # BUT since we are looping many users, we might want to batch this or just queue them all.
        # fastAPI background tasks run AFTER response. For hundreds of users, this is okay.
        # For simple MVP, we just call the service which likely calls resend API.
        
        # We need to construct the unsubscribe token. 
        # In UserPreferences model, it is 'unsubscribe_token'.
        unsub_token = user_prefs.unsubscribe_token if user_prefs else "invalid"
        
        try:
            background_tasks.add_task(
                resend_email_service.send_weekly_digest,
                to_email=user.email,
                username=user.username or "There",
                featured_events=featured_data,
                personalized_events=personalized_data,
                unsubscribe_token=unsub_token
            )
            sent_count += 1
        except Exception as e:
            logger.error(f"Failed to queue digest for {user.email}: {str(e)}")
            
    return {
        "status": "success",
        "message": f"Time to send! Queued {sent_count} weekly digests.",
        "processed_users": len(subscribed_users)
    }


@router.post("/run-cleanup")
def run_system_cleanup(
    session: Session = Depends(get_session),
    authorized: bool = Depends(verify_cron_access)
):
    """
    Cron job to cleanup featured bookings and expire events.
    1. STALE LOCKS: Cancels PENDING_PAYMENT older than 35 mins.
    2. EXPIRY: ACTIVE bookings with end_date in the past -> COMPLETED.
    3. EVENT SYNC: Resets event.featured if no active bookings remain.
    """
    now = datetime.utcnow()
    today = now.date()
    
    # 1. CLEANUP STALE LOCKS (15-minute lock duration)
    stale_cutoff = now - timedelta(minutes=15)
    stale_bookings = session.exec(
        select(FeaturedBooking)
        .where(FeaturedBooking.status == BookingStatus.PENDING_PAYMENT)
        .where(FeaturedBooking.created_at < stale_cutoff)
    ).all()
    
    stale_count = 0
    for b in stale_bookings:
        b.status = BookingStatus.CANCELLED
        b.updated_at = now
        session.add(b)
        stale_count += 1
        
    # 2. EXPIRE ACTIVE BOOKINGS
    expired_bookings = session.exec(
        select(FeaturedBooking)
        .where(FeaturedBooking.status == BookingStatus.ACTIVE)
        .where(FeaturedBooking.end_date < today)
    ).all()
    
    expired_count = 0
    for b in expired_bookings:
        b.status = BookingStatus.COMPLETED
        b.updated_at = now
        session.add(b)
        expired_count += 1
        
    session.commit()
    
    # 3. BIDIRECTIONAL SYNC OF EVENT FLAGS
    # 3a. UN-FEATURE: Reset event.featured if they have no active bookings today
    all_featured_events = session.exec(
        select(Event).where(Event.featured == True)
    ).all()
    
    sync_count = 0
    for event in all_featured_events:
        # Check if any ACTIVE booking covers today for this event
        still_active = session.exec(
            select(FeaturedBooking)
            .where(FeaturedBooking.event_id == event.id)
            .where(FeaturedBooking.status == BookingStatus.ACTIVE)
            .where(FeaturedBooking.start_date <= today)
            .where(FeaturedBooking.end_date >= today)
        ).first()
        
        if not still_active:
            event.featured = False
            event.featured_until = None
            session.add(event)
            sync_count += 1
    
    # 3b. FEATURE: Activate events with bookings that just started today
    # Find all ACTIVE bookings covering today where the event is NOT yet featured
    newly_active_bookings = session.exec(
        select(FeaturedBooking)
        .where(FeaturedBooking.status == BookingStatus.ACTIVE)
        .where(FeaturedBooking.start_date <= today)
        .where(FeaturedBooking.end_date >= today)
    ).all()
    
    activated_count = 0
    for booking in newly_active_bookings:
        event = session.get(Event, booking.event_id)
        if event and not event.featured:
            event.featured = True
            event.featured_until = datetime.combine(booking.end_date, datetime.max.time())
            session.add(event)
            activated_count += 1
            
    session.commit()
    
    logger.info(f"[CRON] Cleanup complete: {stale_count} stale locks cancelled, {expired_count} bookings completed, {sync_count} events un-featured, {activated_count} events activated.")
    
    return {
        "status": "success",
        "stale_cancelled": stale_count,
        "bookings_completed": expired_count,
        "events_unfeatured": sync_count,
        "events_activated": activated_count
    }


@router.post("/promotion-reminders")
async def run_promotion_reminders(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    authorized: bool = Depends(verify_cron_access)
):
    """
    Cron job to send email reminders to event organizers 14 days before their event starts,
    encouraging them to feature it.
    """
    logger.info("Starting Promotion Reminders Cron Job")
    
    # Calculate target range: exactly 14 days from today
    today = datetime.utcnow().date()
    target_date = today + timedelta(days=14)
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date, datetime.max.time())
    
    # Query events starting in this window whose organizers allow reminders and are not featured yet
    query = (
        select(Event, User)
        .join(User, Event.organizer_id == User.id)
        .join(UserPreferences, User.id == UserPreferences.user_id)
        .where(Event.date_start >= start_of_day)
        .where(Event.date_start <= end_of_day)
        .where(Event.featured == False)
        .where(Event.status == "published")
        .where(UserPreferences.allow_promotion_reminders == True)
        .where(User.is_active == True)
    )
    
    results = session.exec(query).all()
    
    sent_count = 0
    for event, user in results:
        try:
            background_tasks.add_task(
                resend_email_service.send_promotion_reminder,
                to_email=user.email,
                event_title=event.title,
                event_id=str(event.id),
                username=user.username or "there"
            )
            sent_count += 1
        except Exception as e:
            logger.error(f"Failed to queue promotion reminder for {user.email} (Event: {event.title}): {str(e)}")
            
    return {
        "status": "success",
        "message": f"Queued {sent_count} promotion reminders.",
        "processed_events": len(results)
    }

