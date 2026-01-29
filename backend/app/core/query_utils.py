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
    sort_field: str = "date",  # "date" or "created"
    excluded_series_ids: Optional[List[str]] = None
) -> tuple[List[Event], int]:
    """
    Deduplicate recurring events, showing only one event per series.

    A series is identified by: COALESCE(parent_event_id, id)
    - For parent events: uses its own ID
    - For child instances: uses the parent_event_id

    This function handles the PostgreSQL vs SQLite difference:
    - PostgreSQL: Cannot use GROUP BY with non-aggregated columns
    - SQLite: Allows GROUP BY with any columns (picks arbitrary row)

    Args:
        session: Database session
        base_query: The base SELECT query (should select Event)
        limit: Max number of results
        offset: Number of results to skip
        order_by_featured: Whether to order by featured status first
        sort_field: Field to sort by ("date" or "created")
        excluded_series_ids: Series IDs to exclude from results

    Returns:
        Tuple of (list of Event objects, total count of unique series)
    """
    is_postgres = get_dialect_name(session) == "postgresql"
    group_key = func.coalesce(Event.parent_event_id, Event.id)

    # Apply exclusion filter if provided
    if excluded_series_ids:
        base_query = base_query.where(group_key.notin_(excluded_series_ids))

    if is_postgres:
        # PostgreSQL approach: Use subquery to get one ID per series
        # Step 1: Create subquery with all filtered events
        base_subquery = base_query.subquery()

        # Step 2: Use DISTINCT ON to get one event per series (earliest date_start)
        # We select just the IDs, ordered by series then date
        distinct_ids_query = (
            select(base_subquery.c.id)
            .distinct(func.coalesce(base_subquery.c.parent_event_id, base_subquery.c.id))
            .order_by(
                func.coalesce(base_subquery.c.parent_event_id, base_subquery.c.id),
                base_subquery.c.date_start.asc()
            )
        )

        # Step 3: Get total count of unique series
        count_query = select(
            func.count(func.distinct(
                func.coalesce(base_subquery.c.parent_event_id, base_subquery.c.id)
            ))
        )
        total = session.exec(count_query).one() or 0

        # Step 4: Get the deduplicated IDs
        dedup_ids = list(session.exec(distinct_ids_query).all())

        if not dedup_ids:
            return [], total

        # Step 5: Fetch full Event objects by those IDs with proper ordering
        events_query = select(Event).where(Event.id.in_(dedup_ids))

        if order_by_featured:
            if sort_field == "created":
                # For "Just Added", we want newest created first
                events_query = events_query.order_by(Event.featured.desc(), Event.created_at.desc())
            elif sort_field == "random":
                events_query = events_query.order_by(Event.featured.desc(), func.random())
            else:
                events_query = events_query.order_by(Event.featured.desc(), Event.date_start.asc())
        else:
            if sort_field == "created":
                events_query = events_query.order_by(Event.created_at.desc())
            elif sort_field == "random":
                events_query = events_query.order_by(func.random())
            else:
                events_query = events_query.order_by(Event.date_start.asc())

        # Apply pagination
        if offset:
            events_query = events_query.offset(offset)
        if limit:
            events_query = events_query.limit(limit)

        events = list(session.exec(events_query).all())

    else:
        # SQLite approach: GROUP BY works with non-aggregated columns
        query = base_query.group_by(group_key)

        # Count total unique series
        count_query = select(func.count()).select_from(query.subquery())
        total = session.exec(count_query).one() or 0

        # Apply ordering
        if order_by_featured:
            if sort_field == "created":
                query = query.order_by(Event.featured.desc(), Event.created_at.desc())
            elif sort_field == "random":
                query = query.order_by(Event.featured.desc(), func.random())
            else:
                query = query.order_by(Event.featured.desc(), func.min(Event.date_start))
        else:
            if sort_field == "created":
                query = query.order_by(Event.created_at.desc())
            elif sort_field == "random":
                query = query.order_by(func.random())
            else:
                query = query.order_by(func.min(Event.date_start))

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
