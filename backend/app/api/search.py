"""
Search utility API routes.
Provides autocomplete and suggestion features.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from pydantic import BaseModel

from app.core.database import get_session
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category
from app.models.tag import Tag

router = APIRouter(tags=["Search"])

class Suggestion(BaseModel):
    term: str
    type: str  # 'topic' or 'location'

class SuggestionResponse(BaseModel):
    suggestions: List[Suggestion]

@router.get("/suggest", response_model=SuggestionResponse)
def get_suggestions(
    q: str = Query(..., min_length=2),
    type: Optional[str] = Query('all', description="'topic', 'location', or 'all'"),
    session: Session = Depends(get_session)
):
    """
    Get unique search suggestions for topics and locations.
    """
    suggestions = []
    search_term = f"%{q}%"

    # 1. Topic Suggestions
    if type in ['all', 'topic']:
        # From Event Titles
        event_titles = session.exec(
            select(Event.title)
            .where(Event.title.ilike(search_term))
            .limit(5)
        ).all()
        for title in event_titles:
            suggestions.append(Suggestion(term=title, type='topic'))

        # From Tags
        tags = session.exec(
            select(Tag.name)
            .where(Tag.name.ilike(search_term))
            .limit(5)
        ).all()
        for tag in tags:
            suggestions.append(Suggestion(term=tag, type='topic'))

        # From Categories
        categories = session.exec(
            select(Category.name)
            .where(Category.name.ilike(search_term))
            .limit(5)
        ).all()
        for cat in categories:
            suggestions.append(Suggestion(term=cat, type='topic'))

    # 2. Location Suggestions
    if type in ['all', 'location']:
        # From Venue Names
        venue_names = session.exec(
            select(Venue.name)
            .where(Venue.name.ilike(search_term))
            .limit(5)
        ).all()
        for name in venue_names:
            suggestions.append(Suggestion(term=name, type='location'))

        # From Venue Towns
        # Note: We'll use address fields for now as 'town' might not be a separate field
        venue_locations = session.exec(
            select(Venue.address)
            .where(Venue.address.ilike(search_term))
            .limit(5)
        ).all()
        for loc in venue_locations:
            # Try to extract something useful or just use the address
            suggestions.append(Suggestion(term=loc, type='location'))
            
        # From Event Location Names
        event_locations = session.exec(
            select(Event.location_name)
            .where(Event.location_name.ilike(search_term))
            .limit(5)
        ).all()
        for loc in event_locations:
            if loc:
                suggestions.append(Suggestion(term=loc, type='location'))

    # Deduplicate and limit
    seen = set()
    unique_suggestions = []
    for s in suggestions:
        key = (s.term.lower(), s.type)
        if key not in seen:
            seen.add(key)
            unique_suggestions.append(s)
            if len(unique_suggestions) >= 15:
                break

    return SuggestionResponse(suggestions=unique_suggestions)
