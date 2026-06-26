"""
Query utilities for PostgreSQL-safe operations.
Handles differences between SQLite and PostgreSQL query requirements.
"""
from typing import List, Optional
from sqlmodel import Session, select, func
from sqlalchemy import text
from sqlalchemy.sql import Select

from app.models.event import Event


def get_dialect_name(session: Session) -> str:
    """Get the database dialect name (postgresql, sqlite, etc.)."""
    return session.bind.dialect.name


def deduplicate_recurring_events(
    session: Session,
    base_query: Select,
    limit: Optional[int] = None,
    offset: int = 0,
    order_by_featured: bool = True,
    sort_field: str = "date",  # "date", "created", or "date_desc"
    excluded_series_ids: Optional[List[str]] = None
) -> tuple[List[Event], int]:
    """
    Deduplicate recurring events, showing only one event per series.
    """
    from app.models.featured_booking import FeaturedBooking, SlotType, BookingStatus
    from sqlalchemy import case, and_, func as sa_func

    is_postgres = get_dialect_name(session) == "postgresql"
    group_key = func.coalesce(Event.recurrence_group_id, Event.parent_event_id, Event.id)

    # Apply exclusion filter if provided
    if excluded_series_ids:
        base_query = base_query.where(group_key.notin_(excluded_series_ids))

    # Calculate pinned priority (promoted slots)
    # We want this to be available for both Postgres and SQLite sorting
    pinned_priority = sa_func.min(case(
        (FeaturedBooking.slot_type == SlotType.PREMIUM, 1),
        (FeaturedBooking.slot_type == SlotType.CATEGORY_PINNED, 2),
        (FeaturedBooking.slot_type == SlotType.MAGAZINE_CAROUSEL, 3),
        else_=4
    ))

    if is_postgres:
        # PostgreSQL approach: Use subquery to get one ID per series
        base_subquery = base_query.subquery()

        # Step 2: Use DISTINCT ON to get one event per series
        distinct_ids_query = (
            select(base_subquery.c.id)
            .distinct(func.coalesce(base_subquery.c.recurrence_group_id, base_subquery.c.parent_event_id, base_subquery.c.id))
            .order_by(
                func.coalesce(base_subquery.c.recurrence_group_id, base_subquery.c.parent_event_id, base_subquery.c.id),
                base_subquery.c.date_start.desc() if sort_field == "date_desc" else base_subquery.c.date_start.asc()
            )
        )

        # Step 3: Get total count
        count_query = select(
            func.count(func.distinct(
                func.coalesce(base_subquery.c.recurrence_group_id, base_subquery.c.parent_event_id, base_subquery.c.id)
            ))
        )
        total = session.exec(count_query).one() or 0

        # Step 4: Get deduplicated IDs
        dedup_ids = list(session.exec(distinct_ids_query).all())

        if not dedup_ids:
            return [], total

        # Step 5: Fetch full Event objects with correct final sorting
        # Join FeaturedBooking again to apply pinning order
        from datetime import date as date_today
        today = date_today.today()
        
        events_query = (
            select(Event)
            .where(Event.id.in_(dedup_ids))
            .outerjoin(
                FeaturedBooking,
                (FeaturedBooking.event_id == Event.id) &
                (FeaturedBooking.status == BookingStatus.ACTIVE) &
                (FeaturedBooking.start_date <= today) &
                (FeaturedBooking.end_date >= today)
            )
            .group_by(Event.id) # Needed because join might return multiple bookings
        )

        # Apply Pinning Priority first
        # Use sa_func.min to handle multiple bookings per event (pick highest priority)
        events_query = events_query.order_by(pinned_priority.asc())

        if order_by_featured:
            active_featured_priority = case(
                (and_(Event.featured == True, Event.featured_until > sa_func.now()), 1),
                else_=0
            ).desc()
            events_query = events_query.order_by(active_featured_priority)
            
        if sort_field == "created":
            events_query = events_query.order_by(Event.created_at.desc())
        elif sort_field == "random":
            events_query = events_query.order_by(func.random())
        elif sort_field == "date_desc":
            events_query = events_query.order_by(Event.date_start.desc())
        else:
            events_query = events_query.order_by(Event.date_start.asc())

        # Apply pagination
        if offset:
            events_query = events_query.offset(offset)
        if limit:
            events_query = events_query.limit(limit)

        events = list(session.exec(events_query).all())

    else:
        # SQLite approach
        query = base_query.group_by(group_key)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = session.exec(count_query).one() or 0

        # Apply ordering
        # Note: SQLite grouping requires aggregation for joined columns typically
        query = query.order_by(pinned_priority.asc())
        
        if order_by_featured:
            active_featured_priority = case(
                (and_(Event.featured == True, Event.featured_until > sa_func.now()), 1),
                else_=0
            ).desc()
            query = query.order_by(active_featured_priority)

        if sort_field == "created":
            query = query.order_by(Event.created_at.desc())
        elif sort_field == "random":
            query = query.order_by(func.random())
        elif sort_field == "date_desc":
            query = query.order_by(func.max(Event.date_start).desc())
        else:
            query = query.order_by(func.min(Event.date_start).asc())

        # Apply pagination
        if offset:
            query = query.offset(offset)
        if limit:
            query = query.limit(limit)

        events = list(session.exec(query).all())

    return events, total


def deduplicate_recurring_events_simple(
    session: Session,
    base_query: Select,
    limit: int,

    excluded_series_ids: Optional[List[str]] = None,
    order_by_featured: bool = True,
    sort_field: str = "date"
) -> List[Event]:
    """
    Simplified version that just returns events without total count.
    Useful for recommendation queries where count isn't needed.
    """
    events, _ = deduplicate_recurring_events(
        session=session,
        base_query=base_query,
        limit=limit,

        excluded_series_ids=excluded_series_ids,
        order_by_featured=order_by_featured,
        sort_field=sort_field
    )
    return events
