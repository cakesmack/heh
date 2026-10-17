"""Read-only, editorial shortlist queries; no publication or tracking changes."""
from datetime import datetime

from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import aliased, selectinload
from sqlmodel import select

from app.models.event import Event
from app.models.venue import Venue
from app.core.location_filters import event_location_filter, event_location_parts


def popularity_score(views, website_clicks, ticket_clicks):
    return (views or 0) + 3 * (website_clicks or 0) + 5 * (ticket_clicks or 0)


def public_eligibility():
    return and_(Event.status == 'published', Event.is_cancelled == False)


def shortlist_query(start: datetime, end: datetime, location_name=None):
    score = (func.coalesce(Event.view_count, 0) + 3 * func.coalesce(Event.website_click_count, 0)
             + 5 * func.coalesce(Event.ticket_click_count, 0))
    # Venue-less events are separate candidates, not one shared NULL partition.
    venue_key = case((Event.venue_id.is_not(None), 'venue:' + Event.venue_id),
                     else_='event:' + Event.id)
    query = select(Event.id.label('event_id'), score.label('score'), func.row_number().over(
        partition_by=venue_key, order_by=(score.desc(), Event.date_start.asc(), Event.id.asc())
    ).label('venue_rank')).outerjoin(Venue, Event.venue_id == Venue.id).where(
        public_eligibility(),
        Event.date_start >= start, Event.date_start < end,
    )
    if location_name:
        query = query.where(event_location_filter(location_name))
    ranked = query.subquery()
    return (select(Event).join(ranked, Event.id == ranked.c.event_id).where(ranked.c.venue_rank == 1)
            .options(selectinload(Event.venue), selectinload(Event.category_rel))
            .order_by(ranked.c.score.desc(), Event.date_start.asc(), Event.id.asc()).limit(20))


def shortlist_diagnostics(session, start, end, location_name=None):
    """Temporary opt-in counts, before venue deduplication/top-20 limiting."""
    eligible = public_eligibility()
    conditions = {'public_eligible_events': eligible}
    if location_name:
        primary, participating, event_fields = event_location_parts(location_name)
        city_only = func.lower(func.trim(Venue.city)) == location_name.strip().lower()
        legacy_participating = aliased(Venue)
        participating_city_only = func.lower(func.trim(legacy_participating.city)) == location_name.strip().lower()
        conditions.update({
            'primary_venue_matches': and_(eligible, primary),
            'participating_venue_matches': and_(eligible, participating),
            'event_location_matches': and_(eligible, event_fields),
            'location_matches': and_(eligible, or_(primary, participating, event_fields)),
            'legacy_exact_city_matches': and_(eligible, or_(city_only, Event.participating_venues.of_type(legacy_participating).any(participating_city_only))),
        })
    query = select(func.count(Event.id).label('events_in_date_range'), *[
        func.coalesce(func.sum(case((condition, 1), else_=0)), 0).label(name)
        for name, condition in conditions.items()
    ]).outerjoin(Venue, Event.venue_id == Venue.id).where(Event.date_start >= start, Event.date_start < end)
    return {name: int(value) for name, value in session.exec(query).one()._mapping.items()}
