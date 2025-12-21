from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, desc
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.follow import Follow
from app.models.event import Event
from app.models.venue import Venue
from app.models.organizer import Organizer
from app.schemas.event import EventResponse

router = APIRouter()

@router.post("/follow/{target_type}/{target_id}", response_model=Follow)
def follow_target(
    target_type: str,
    target_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Follow a venue or organizer (group).
    """
    if target_type not in ["venue", "group"]:
        raise HTTPException(status_code=400, detail="Invalid target type. Must be 'venue' or 'group'.")

    print(f"DEBUG: follow_target type={target_type} id={target_id}")
    if target_type == "venue":
        # Try exact match first
        target = session.get(Venue, target_id)
        if not target:
            # Try removing dashes (if input has them)
            clean_id = target_id.replace("-", "")
            if clean_id != target_id:
                target = session.get(Venue, clean_id)
        
        if not target:
             # Try adding dashes (if input doesn't have them - harder to guess placement, but maybe standard UUID?)
             # For now, just try to find by ID using select which might be more lenient?
             target = session.exec(select(Venue).where(Venue.id == target_id)).first()

        print(f"DEBUG: Venue lookup result: {target}")
    else:
        target = session.get(Organizer, target_id)
        print(f"DEBUG: Organizer lookup result: {target}")
    
    if not target:
        # Debug: list some venue IDs to see what's going on
        debug_msg = ""
        if target_type == "venue":
            all_venues = session.exec(select(Venue.id).limit(5)).all()
            print(f"DEBUG: Sample Venue IDs in DB: {all_venues}")
            debug_msg = f" (Input ID: {target_id}, Sample DB IDs: {all_venues})"
        
        raise HTTPException(status_code=404, detail=f"{target_type.capitalize()} not found{debug_msg}")

    # Check if already following
    existing_follow = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.target_id == target_id
        )
    ).first()

    if existing_follow:
        return existing_follow

    # Create follow
    follow = Follow(
        follower_id=current_user.id,
        target_id=target.id,
        target_type=target_type
    )
    session.add(follow)
    session.commit()
    session.refresh(follow)
    return follow

@router.delete("/follow/{target_type}/{target_id}")
def unfollow_target(
    target_type: str,
    target_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Unfollow a venue or organizer.
    """
    # Try to find follow with exact ID first
    follow = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.target_id == target_id
        )
    ).first()

    if not follow:
        # Try with/without dashes just in case
        clean_id = target_id.replace("-", "")
        if clean_id != target_id:
             follow = session.exec(
                select(Follow).where(
                    Follow.follower_id == current_user.id,
                    Follow.target_id == clean_id
                )
            ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Not following this target")

    session.delete(follow)
    session.commit()
    return {"ok": True}

@router.get("/following/{target_id}", response_model=bool)
def check_is_following(
    target_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Check if current user follows a target.
    """
    # Check exact match
    follow = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.target_id == target_id
        )
    ).first()
    
    if not follow:
        # Check alternate format
        clean_id = target_id.replace("-", "")
        if clean_id != target_id:
            follow = session.exec(
                select(Follow).where(
                    Follow.follower_id == current_user.id,
                    Follow.target_id == clean_id
                )
            ).first()

    return follow is not None

@router.get("/feed", response_model=List[EventResponse])
def get_activity_feed(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get events from followed venues and organizers.
    """
    from app.api.events import build_event_response
    
    # Get all followed IDs
    follows = session.exec(
        select(Follow).where(Follow.follower_id == current_user.id)
    ).all()
    
    if not follows:
        return []

    followed_venue_ids = [f.target_id for f in follows if f.target_type == "venue"]
    followed_group_ids = [f.target_id for f in follows if f.target_type == "group"]

    # Query events
    # Logic: Events at followed venues OR events by followed organizers
    # Filter out child recurring events (show only parents)
    
    query = select(Event).where(
        (Event.venue_id.in_(followed_venue_ids)) | 
        (Event.organizer_profile_id.in_(followed_group_ids))
    ).where(Event.parent_event_id == None).order_by(desc(Event.created_at)).offset(skip).limit(limit)
    
    events = session.exec(query).all()
    
    # Build proper EventResponse objects with venue data
    return [build_event_response(event, session) for event in events]
