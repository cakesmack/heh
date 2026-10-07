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
    window_days: int = 180,
    *,
    after: Optional[datetime] = None,
    through: Optional[datetime] = None,
    raise_errors: bool = False,
    commit: bool = True,
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
        if through is not None:
            end_date_limit = through
        elif recurrence_end_date:
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

        lower_bound = after or start_dt
        if lower_bound.tzinfo is None:
            lower_bound = lower_bound.replace(tzinfo=timezone.utc)
            
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
                 dates_to_generate = list(rule.between(lower_bound, end_date_limit, inc=True))
                 
             except Exception as e:
                 logger.error(f"RRULE Parsing failed for event {parent_event.id}: {e}")
                 if raise_errors:
                     raise
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
                 dates_to_generate = list(rule.between(lower_bound, end_date_limit, inc=True))
        elif raise_errors:
            raise ValueError("Recurring parent has no supported recurrence rule")

        # Filter out the parent's own start date (avoid duplication) and past dates?
        # Only future instances? Or all? Usually we want future relative to parent.
        filtered_dates = [d for d in dates_to_generate if d > max(start_dt, lower_bound)]

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
                is_all_day=parent_event.is_all_day,
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
            child_event.tags = list(parent_event.tags)
            child_event.participating_venues = list(parent_event.participating_venues)
            new_instances.append(child_event)
            existing_dates.add(dt_final.date())

        if new_instances:
            if commit:
                session.commit()
            else:
                session.flush()
            logger.info(f"Generated {len(new_instances)} recurring instances for event {parent_event.id}")
            
    except Exception as e:
        logger.error(f"Error generating recurring instances for {parent_event.id}: {e}")
        if raise_errors:
            raise
        traceback.print_exc() 

    return new_instances


def is_ongoing_recurring(parent: Event) -> bool:
    """Older finite parents may encode their end only in the stored RRULE."""
    import re
    return bool(
        parent.is_recurring
        and not parent.parent_event_id
        and not parent.is_cancelled
        and parent.recurrence_end_date is None
        and not re.search(r"(?:^|[;:])(?:UNTIL|COUNT)=", parent.recurrence_rule or "", re.IGNORECASE)
    )


def replenish_recurring_parent(session: Session, parent_id: str, *, now: Optional[datetime] = None, horizon_days: int = 180) -> List[Event]:
    """Append beyond the latest child, under a parent lock; never repair past gaps.

    Event timestamps in this database are Europe/London wall times. Keeping the
    original rule anchor preserves interval phase and times across clock changes.
    The caller commits, retaining the row lock throughout generation.
    """
    from zoneinfo import ZoneInfo
    from sqlalchemy import func

    parent = session.exec(select(Event).where(Event.id == parent_id).with_for_update()).first()
    if parent is None or not is_ongoing_recurring(parent):
        return []
    now = now or datetime.now(ZoneInfo("Europe/London"))
    if now.tzinfo is not None:
        now = now.astimezone(ZoneInfo("Europe/London")).replace(tzinfo=None)
    latest = session.exec(select(func.max(Event.date_start)).where(Event.parent_event_id == parent.id)).one()
    marker = max(parent.date_start, latest or parent.date_start, now)
    return generate_recurring_instances(
        session, parent, after=marker, through=now + timedelta(days=horizon_days),
        raise_errors=True, commit=False,
    )
