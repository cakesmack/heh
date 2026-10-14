"""Read-only, editorial shortlist queries; no publication or tracking changes."""
from datetime import datetime

from sqlalchemy import case, func
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.models.event import Event
from app.models.venue import Venue


def popularity_score(views, website_clicks, ticket_clicks):
    return (views or 0) + 3 * (website_clicks or 0) + 5 * (ticket_clicks or 0)


def shortlist_query(start: datetime, end: datetime, location_name=None):
    score = (func.coalesce(Event.view_count, 0) + 3 * func.coalesce(Event.website_click_count, 0)
             + 5 * func.coalesce(Event.ticket_click_count, 0))
    # Venue-less events are separate candidates, not one shared NULL partition.
    venue_key = case((Event.venue_id.is_not(None), 'venue:' + Event.venue_id),
                     else_='event:' + Event.id)
    query = select(Event.id.label('event_id'), score.label('score'), func.row_number().over(
        partition_by=venue_key, order_by=(score.desc(), Event.date_start.asc(), Event.id.asc())
    ).label('venue_rank')).outerjoin(Venue, Event.venue_id == Venue.id).where(
        Event.status == 'published', Event.is_cancelled == False,
        Event.date_start >= start, Event.date_start < end,
    )
    if location_name:
        city_matches = func.lower(func.trim(Venue.city)) == location_name.strip().lower()
        query = query.where(city_matches | Event.participating_venues.any(city_matches))
    ranked = query.subquery()
    return (select(Event).join(ranked, Event.id == ranked.c.event_id).where(ranked.c.venue_rank == 1)
            .options(selectinload(Event.venue), selectinload(Event.category_rel))
            .order_by(ranked.c.score.desc(), Event.date_start.asc(), Event.id.asc()).limit(20))
