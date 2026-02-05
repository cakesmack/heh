from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4
from sqlmodel import Session, select
import logging

from app.models.event import Event
from app.core.utils import normalize_uuid

logger = logging.getLogger(__name__)

def generate_recurring_instances(
    session: Session,
    parent_event: Event,
    weekdays: Optional[List[int]] = None,
    recurrence_end_date: Optional[datetime] = None,
    window_days: int = 90
) -> List[Event]:
    """
    Generate event instances for a recurring event using an inclusive loop.
    
    CRITICAL: This function must perform DATABASE operations only.
    It does NOT send emails or notifications. Child instances are created silently.
    Notifications are handled by the parent event creation logic only.
    
    Args:
        session: Database session
        parent_event: The master event
        weekdays: List of weekdays (0=Mon, 6=Sun) to repeat on.
        recurrence_end_date: Specific end date for the series.
        window_days: Fallback duration if no end date provided.
    """
    if not parent_event.is_recurring:
        return []

    new_instances = []
    
    try:
        # Determine the effective end date for generation
        if recurrence_end_date:
            # Set to 23:59:59 to ensure inclusive comparison
            end_date = recurrence_end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        else:
            # Default window
            end_date = datetime.utcnow() + timedelta(days=window_days)
            
        # Calculate event duration
        duration = parent_event.date_end - parent_event.date_start
        
        # Get start date
        current_date = parent_event.date_start
        
        # Infer weekdays if not provided (default to same day of week)
        effective_weekdays = weekdays
        if not effective_weekdays:
            effective_weekdays = [current_date.weekday()]
            
        # Start loop from the NEXT day (parent exists on start date)
        current_date = current_date + timedelta(days=1)
        
        # Align timezone for comparison
        if current_date.tzinfo is not None and current_date.tzinfo.utcoffset(current_date) is not None:
             if end_date.tzinfo is None:
                 end_date = end_date.replace(tzinfo=current_date.tzinfo)
        else:
             if end_date.tzinfo is not None:
                 end_date = end_date.replace(tzinfo=None)

        # Pre-fetch existing start dates to avoid duplicates
        existing_instances = session.exec(
            select(Event).where(
                Event.parent_event_id == parent_event.id,
                Event.date_start >= current_date
            )
        ).all()
        existing_dates = {e.date_start.date() for e in existing_instances}

        while current_date <= end_date:
            # Check if this day's weekday is in selected weekdays
            if current_date.weekday() in effective_weekdays:
                
                # Check for duplicates (by date)
                if current_date.date() in existing_dates:
                    current_date += timedelta(days=1)
                    continue

                # Create child event - DB ONLY, NO EMAILS
                child_event = Event(
                    id=normalize_uuid(uuid4()),
                    title=parent_event.title,
                    description=parent_event.description,
                    date_start=current_date,
                    date_end=current_date + duration,
                    venue_id=parent_event.venue_id,
                    location_name=parent_event.location_name,
                    latitude=parent_event.latitude,
                    longitude=parent_event.longitude,
                    geohash=parent_event.geohash,
                    category_id=parent_event.category_id,
                    price=parent_event.price,
                    price_display=parent_event.price_display,
                    min_price=parent_event.min_price,
                    image_url=parent_event.image_url,
                    ticket_url=parent_event.ticket_url,
                    website_url=parent_event.website_url,
                    age_restriction=parent_event.age_restriction,
                    min_age=parent_event.min_age,
                    organizer_id=parent_event.organizer_id,
                    organizer_profile_id=parent_event.organizer_profile_id,
                    status=parent_event.status, # Inherit status, but do not trigger listeners
                    is_recurring=True,
                    parent_event_id=parent_event.id,
                    recurrence_group_id=parent_event.recurrence_group_id,
                )
                session.add(child_event)
                new_instances.append(child_event)
            
            current_date += timedelta(days=1)
            
        if new_instances:
            session.commit()
            logger.info(f"Generated {len(new_instances)} recurring instances for event {parent_event.id} (Silent/No Email)")
            
    except Exception as e:
        logger.error(f"Error generating recurring instances for {parent_event.id}: {e}")
        # Don't raise, just return empty
        
    return new_instances
