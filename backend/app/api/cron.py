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
from app.api.email_testing import get_featured_events, format_event_data
from app.services.resend_email import resend_email_service

router = APIRouter(prefix="/cron", tags=["Cron Jobs"])
logger = logging.getLogger(__name__)

CRON_SECRET = os.getenv("CRON_SECRET", "super-secret-cron-key")

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
    featured_data = [format_event_data(e) for e in featured_raw]
    
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
         
    popular_data = [format_event_data(e) for e in popular_raw]
    
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
            personalized_data = [format_event_data(e) for e in matches]
            
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
                display_name=user.display_name or user.username or "There",
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
