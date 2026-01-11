"""
Bookmarks API routes.
Handles toggling bookmarks and listing saved events.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.models.user import User
from app.models.event import Event
from app.models.bookmark import Bookmark
from app.schemas.event import EventListResponse
from app.api.events import build_event_response

router = APIRouter(tags=["Bookmarks"])


@router.post("/{event_id}", status_code=status.HTTP_200_OK)
def toggle_bookmark(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Toggle bookmark for an event.
    If bookmark exists, delete it. If not, create it.
    """
    normalized_event_id = normalize_uuid(event_id)
    event = session.get(Event, normalized_event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Check if bookmark(s) exist - fetch ALL to handle potential duplicates
    bookmarks = session.exec(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.event_id == normalized_event_id
        )
    ).all()

    if bookmarks:
        # Remove bookmark(s) - handle potential duplicates by deleting all
        for bookmark in bookmarks:
            session.delete(bookmark)
        session.commit()
        return {"bookmarked": False, "message": "Event removed from bookmarks"}
    else:
        # Add bookmark
        new_bookmark = Bookmark(user_id=current_user.id, event_id=normalized_event_id)
        session.add(new_bookmark)
        session.commit()
        return {"bookmarked": True, "message": "Event added to bookmarks"}


@router.get("/check/{event_id}", status_code=status.HTTP_200_OK)
def check_bookmark_status(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Check if an event is bookmarked by the current user.
    """
    normalized_event_id = normalize_uuid(event_id)
    bookmark = session.exec(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.event_id == normalized_event_id
        )
    ).first()

    return {"bookmarked": bookmark is not None}


@router.get("/my", response_model=EventListResponse)
def list_my_bookmarks(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    List events bookmarked by the current user.
    """
    # Query events joined with bookmarks
    query = select(Event).join(Bookmark, Event.id == Bookmark.event_id).where(
        Bookmark.user_id == current_user.id
    ).order_by(Bookmark.created_at.desc())

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()

    # Pagination
    query = query.offset(skip).limit(limit)
    events = session.exec(query).all()

    # Build responses
    event_responses = [
        build_event_response(event, session)
        for event in events
    ]

    return EventListResponse(
        events=event_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/count/{event_id}", status_code=status.HTTP_200_OK)
def get_bookmark_count(
    event_id: str,
    session: Session = Depends(get_session)
):
    """
    Get the total number of users who have bookmarked an event.
    This is a public endpoint (no auth required) for social proof display.
    """
    normalized_event_id = normalize_uuid(event_id)
    
    count = session.exec(
        select(func.count(Bookmark.id))
        .where(Bookmark.event_id == normalized_event_id)
    ).one()
    
    return {"count": count}
