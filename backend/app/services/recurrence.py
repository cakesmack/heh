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
    import traceback
    from dateutil.rrule import rrulestr, rrule, WEEKLY
    from datetime import timezone

    if not parent_event.is_recurring:
        return []

    new_instances = []
    
    try:
        # Determine the effective end date (limit)
        if recurrence_end_date:
            end_date_limit = recurrence_end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        else:
            end_date_limit = datetime.utcnow() + timedelta(days=window_days)
            
        # Calculate event duration
        duration = parent_event.date_end - parent_event.date_start
        
        # Get start date and align Timezone for RRule compatibility
        # If DB returns naive datetime (common in SQLModel/SQLite), assume UTC
        start_dt = parent_event.date_start
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
            
        # Align limit to UTC as well
        if end_date_limit.tzinfo is None:
            end_date_limit = end_date_limit.replace(tzinfo=timezone.utc)

        dates_to_generate = []

        # STRATEGY 1: Use provided RRULE (Prioritized)
        if parent_event.recurrence_rule:
             try:
                 # Ensure proper string format (handling FREQ= vs RRULE:FREQ=)
                 rule_str = parent_event.recurrence_rule
                 if not rule_str.upper().startswith("RRULE:") and not rule_str.upper().startswith("FREQ="):
                     # If it's just "WEEKLY", we can't parse it. But we shouldn't get here if so.
                     # Assuming standard property string "FREQ=WEEKLY;..."
                     pass

                 # Parse the rule
                 # dtstart provides the start time (and timezone)
                 rule = rrulestr(rule_str, dtstart=start_dt)
                 
                 # Generate dates within window (excluding start itself if matched)
                 # We use between() to be safe and efficient
                 # inc=True allows start date, we filter it out later
                 dates_to_generate = list(rule.between(start_dt, end_date_limit, inc=True))
                 
             except Exception as e:
                 logger.error(f"RRULE Parsing failed for event {parent_event.id}: {e}")
                 # Fallback to empty or continue to legacy?
                 # Let's try legacy if parsing fails? Or just fail.
                 # Given the high risk of regression, let's just log and return empty for now.
                 pass

        # STRATEGY 2: Legacy Weekdays Logic (Fallback if no RRULE)
        elif weekdays:
             # Legacy logic support for explicit weekdays without RRULE
             # We can construct an RRULE on the fly!
             # This unifies the logic.
             # rrule(FREQ=WEEKLY, byweekday=weekdays, dtstart=start_dt)
             
             # Map int weekdays to rrule constants (0=MO, 6=SU)
             # dateutil uses MO, TU... which are objects.
             from dateutil.rrule import MO, TU, WE, TH, FR, SA, SU
             rrule_days = [MO, TU, WE, TH, FR, SA, SU]
             by_days = [rrule_days[d] for d in weekdays if 0 <= d <= 6]
             
             if by_days:
                 rule = rrule(WEEKLY, dtstart=start_dt, byweekday=by_days)
                 dates_to_generate = list(rule.between(start_dt, end_date_limit, inc=True))

        # Filter out the parent's own start date (avoid duplication) and past dates?
        # Only future instances? Or all? Usually we want future relative to parent.
        filtered_dates = [d for d in dates_to_generate if d > start_dt]

        # Convert back to Naive if original was Naive (to match DB field expectation)
        is_naive_db = parent_event.date_start.tzinfo is None
        
        # Pre-fetch existing
        if is_naive_db:
            check_date = start_dt.replace(tzinfo=None) + timedelta(days=1)
        else:
            check_date = start_dt + timedelta(days=1)

        # Optimization: Fetch existing start dates
        existing_instances = session.exec(
            select(Event).where(
                Event.parent_event_id == parent_event.id,
                Event.date_start >= check_date
            )
        ).all()
        # Ensure we compare apples to apples (dates)
        existing_dates = {e.date_start.date() for e in existing_instances}

        for dt in filtered_dates:
            # Handle Timezone Output
            if is_naive_db:
                dt_final = dt.replace(tzinfo=None)
            else:
                dt_final = dt

            # Duplicate Check
            if dt_final.date() in existing_dates:
                continue

            # Create Child
            child_event = Event(
                id=normalize_uuid(uuid4()),
                title=parent_event.title,
                description=parent_event.description,
                date_start=dt_final,
                date_end=dt_final + duration,
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
                status=parent_event.status, 

                parent_event_id=parent_event.id,
                recurrence_group_id=parent_event.recurrence_group_id,
                # Copy recurrence rule to child? Usually no, child is simpler.
                # But Google Calendar does copy it. 
                # For now, keep child simple (not recurring itself).
                is_recurring=False 
            )
            session.add(child_event)
            new_instances.append(child_event)

        if new_instances:
            session.commit()
            logger.info(f"Generated {len(new_instances)} recurring instances for event {parent_event.id}")
            
    except Exception as e:
        logger.error(f"Error generating recurring instances for {parent_event.id}: {e}")
        traceback.print_exc() 

    return new_instances
