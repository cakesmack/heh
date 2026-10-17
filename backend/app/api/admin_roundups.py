"""Admin-only candidate selection for manually curated event posters."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.api.admin import require_admin
from app.core.database import get_session
from app.core.utils import to_london_naive
from app.models.location import Location
from app.models.user import User
from app.services.event_roundups import popularity_score, shortlist_query, shortlist_diagnostics

router = APIRouter()


class RoundupVenue(BaseModel):
    id: str
    name: str


class RoundupCandidate(BaseModel):
    id: str
    title: str
    date_start: datetime
    date_end: Optional[datetime] = None
    image_url: Optional[str] = None
    venue_name: Optional[str] = None
    venues: list[RoundupVenue] = Field(default_factory=list)
    venue_address: Optional[str] = None
    town: Optional[str] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    view_count: int
    website_click_count: int
    ticket_click_count: int
    popularity_score: int


class RoundupShortlist(BaseModel):
    start: datetime
    end: datetime
    location_name: Optional[str] = None
    candidates: list[RoundupCandidate]
    diagnostics: Optional[dict[str, int]] = None


@router.get('/roundups/candidates', response_model=RoundupShortlist)
def roundup_candidates(start: datetime, end: datetime, location_id: Optional[int] = None,
                       admin: User = Depends(require_admin), session: Session = Depends(get_session), diagnostics: bool = False):
    start, end = to_london_naive(start), to_london_naive(end)
    if start >= end:
        raise HTTPException(422, 'End must be after start (exclusive)')
    if (end - start).days > 366:
        raise HTTPException(422, 'Choose a range of at most one year')
    location = session.get(Location, location_id) if location_id is not None else None
    if location_id is not None and location is None:
        raise HTTPException(404, 'Location not found')
    events = session.exec(shortlist_query(start, end, location.name if location else None)).all()
    candidates = []
    for event in events:
        venue, category = event.venue, event.category_rel
        candidates.append(RoundupCandidate(
            id=event.id, title=event.title, date_start=event.date_start, date_end=event.date_end,
            image_url=event.image_url, venue_name=venue.name if venue else event.location_name,
            venues=[RoundupVenue(id=item.id, name=item.name) for item in
                    {item.id: item for item in ([venue] if venue else []) + list(event.participating_venues)}.values()],
            venue_address=venue.address if venue else event.address_full,
            town=venue.city if venue else None, category_name=category.name if category else None,
            category_color=category.gradient_color if category else None,
            view_count=event.view_count or 0, website_click_count=event.website_click_count or 0,
            ticket_click_count=event.ticket_click_count or 0,
            popularity_score=popularity_score(event.view_count, event.website_click_count, event.ticket_click_count),
        ))
    return RoundupShortlist(start=start, end=end, location_name=location.name if location else None, candidates=candidates,
                           diagnostics=shortlist_diagnostics(session, start, end, location.name if location else None) if diagnostics else None)
