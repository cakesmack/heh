"""Read-only occurrence selection using the existing London-local schedule storage."""
from datetime import date, datetime, time, timezone
from sqlalchemy import and_, or_, exists, func
from sqlmodel import select

from app.core.utils import to_london_naive
from app.models.event import Event
from app.models.showtime import EventShowtime


def event_now():
    return to_london_naive(datetime.now(timezone.utc))


def local_bound(value, end=False):
    if isinstance(value, str):
        value = date.fromisoformat(value) if len(value) == 10 else datetime.fromisoformat(value.replace("Z", "+00:00"))
    if isinstance(value, date) and not isinstance(value, datetime):
        return datetime.combine(value, time.max if end else time.min)
    return to_london_naive(value)


def effective_end(start, end, all_day=False):
    end = to_london_naive(end or start)
    return datetime.combine(end.date(), time.max) if all_day else end


def occurrence_filter(date_from=None, date_to=None):
    """An actual performance must overlap; a multi-date envelope is not a performance."""
    lower = local_bound(date_from)
    upper = local_bound(date_to, end=True)

    def overlaps(start, end):
        end = func.coalesce(end, start)
        conditions = []
        if lower is not None:
            conditions.append(or_(
                and_(Event.is_all_day == False, end >= lower),
                and_(Event.is_all_day == True, func.date(end) >= lower.date().isoformat()),
            ))
        if upper is not None:
            conditions.append(start <= upper)
        return and_(*conditions)

    has_showtimes = exists(select(EventShowtime.id).where(EventShowtime.event_id == Event.id).correlate(Event))
    matching_showtime = exists(select(EventShowtime.id).where(
        EventShowtime.event_id == Event.id,
        overlaps(EventShowtime.start_time, EventShowtime.end_time),
    ).correlate(Event))
    return or_(and_(~has_showtimes, overlaps(Event.date_start, Event.date_end)), matching_showtime)


def relevant_dates(event, date_from=None, date_to=None):
    """Choose an overlapping/current/next performance without mutating persisted fields."""
    ranges = [(s.start_time, s.end_time) for s in event.showtimes] or [(event.date_start, event.date_end)]
    ranges = [(to_london_naive(start), effective_end(start, end, event.is_all_day)) for start, end in ranges]
    ranges.sort(key=lambda pair: pair[0])
    lower = local_bound(date_from) if date_from is not None else (datetime.min if date_to is not None else event_now())
    upper = local_bound(date_to, end=True)
    matching = [pair for pair in ranges if pair[1] >= lower and (upper is None or pair[0] <= upper)]
    return matching[0] if matching else ranges[-1]


def matching_showtimes(event, date_from=None, date_to=None):
    lower = local_bound(date_from) if date_from is not None else (datetime.min if date_to is not None else event_now())
    upper = local_bound(date_to, end=True)
    return sorted([
        show for show in event.showtimes
        if effective_end(show.start_time, show.end_time, event.is_all_day) >= lower
        and (upper is None or to_london_naive(show.start_time) <= upper)
    ], key=lambda show: to_london_naive(show.start_time))


def display_event(event, date_from=None, date_to=None):
    """Detached response copy for endpoints whose legacy response schema is Event."""
    start, end = relevant_dates(event, date_from, date_to)
    return event.model_copy(update={"date_start": start, "date_end": end})
