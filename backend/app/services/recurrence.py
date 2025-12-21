from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4
from dateutil.rrule import rrule, rrulestr
from sqlmodel import Session, select

from app.models.event import Event
from app.core.utils import normalize_uuid

def generate_recurring_instances(
    session: Session,
    parent_event: Event,
    window_days: int = 90
) -> List[Event]:
    """
    Generate event instances for a recurring event within a rolling window.
    Only generates instances that don't already exist.
    """
    if not parent_event.is_recurring or not parent_event.recurrence_rule:
        return []

    # Parse RRULE
    try:
        rule = rrulestr(parent_event.recurrence_rule, dtstart=parent_event.date_start)
    except Exception as e:
        print(f"Error parsing RRULE for event {parent_event.id}: {e}")
        return []

    # Define window
    now = datetime.utcnow()
    window_end = now + timedelta(days=window_days)

    # Get existing instances to avoid duplicates
    existing_instances = session.exec(
        select(Event).where(Event.parent_event_id == parent_event.id)
    ).all()
    
    # Map existing start dates for quick lookup (ignoring time for simplicity if needed, but strict for now)
    existing_dates = {e.date_start for e in existing_instances}
    # Add parent's own date to avoid duplicating it if it falls in window
    existing_dates.add(parent_event.date_start)

    new_instances = []
    
    # Generate dates
    # We start from now to avoid generating past events, or from parent start?
    # Usually we want to fill the window from NOW.
    for dt in rule.between(now, window_end, inc=True):
        if dt in existing_dates:
            continue

        # Calculate duration
        duration = parent_event.date_end - parent_event.date_start
        
        # Create new instance
        # We copy most fields from parent
        instance = Event(
            id=normalize_uuid(uuid4()),
            title=parent_event.title,
            description=parent_event.description,
            date_start=dt,
            date_end=dt + duration,
            venue_id=parent_event.venue_id,
            location_name=parent_event.location_name,
            latitude=parent_event.latitude,
            longitude=parent_event.longitude,
            geohash=parent_event.geohash,
            category_id=parent_event.category_id,
            price=parent_event.price,
            featured=False, # Instances aren't automatically featured? Or should they be?
            status=parent_event.status,
            organizer_id=parent_event.organizer_id,
            organizer_profile_id=parent_event.organizer_profile_id,
            image_url=parent_event.image_url,
            ticket_url=parent_event.ticket_url,
            age_restriction=parent_event.age_restriction,
            postcode=parent_event.postcode,
            address_full=parent_event.address_full,
            
            # Recurrence linkage
            is_recurring=True,
            recurrence_rule=parent_event.recurrence_rule,
            parent_event_id=parent_event.id
        )
        
        session.add(instance)
        new_instances.append(instance)

    if new_instances:
        session.commit()
        
    return new_instances
