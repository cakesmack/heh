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
    Get events from followed venues, organizers, and categories.
    """
    from app.api.events import build_event_response
    from app.models.user_category_follow import UserCategoryFollow
    
    # Get all venue/group follows
    follows = session.exec(
        select(Follow).where(Follow.follower_id == current_user.id)
    ).all()
    
    # Get all category follows
    category_follows = session.exec(
        select(UserCategoryFollow).where(UserCategoryFollow.user_id == current_user.id)
    ).all()
    
    # If not following anything, return empty
    if not follows and not category_follows:
        return []

    followed_venue_ids = [f.target_id for f in follows if f.target_type == "venue"]
    followed_group_ids = [f.target_id for f in follows if f.target_type == "group"]
    followed_category_ids = [f.category_id for f in category_follows]

    # Build query conditions
    conditions = []
    if followed_venue_ids:
        conditions.append(Event.venue_id.in_(followed_venue_ids))
    if followed_group_ids:
        conditions.append(Event.organizer_profile_id.in_(followed_group_ids))
    if followed_category_ids:
        conditions.append(Event.category_id.in_(followed_category_ids))
    
    if not conditions:
        return []
    
    # Query events matching any followed interest
    # Filter out child recurring events (show only parents)
    # CRITICAL: Only show published events (not deleted/pending)
    from sqlalchemy import or_
    
    query = select(Event).where(
        or_(*conditions)
    ).where(
        Event.parent_event_id == None
    ).where(
        Event.status == "published"
    ).order_by(desc(Event.created_at)).offset(skip).limit(limit)
    
    events = session.exec(query).all()
    
    # Build proper EventResponse objects with venue data
    return [build_event_response(event, session) for event in events]


@router.get("/following/venues")
def get_followed_venues(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get all venues the current user follows.
    """
    from app.core.utils import normalize_uuid
    import logging
    logger = logging.getLogger(__name__)
    
    follows = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.target_type == "venue"
        )
    ).all()
    
    logger.info(f"User {current_user.id} has {len(follows)} venue follows")
    
    if not follows:
        return {"venues": [], "total": 0}
    
    # Normalize UUIDs to handle format differences
    venue_ids = [normalize_uuid(f.target_id) for f in follows]
    logger.info(f"Looking for venues with IDs: {venue_ids}")
    
    venues = session.exec(
        select(Venue).where(Venue.id.in_(venue_ids))
    ).all()
    
    logger.info(f"Found {len(venues)} matching venues")
    
    return {
        "venues": [{"id": v.id, "name": v.name, "slug": v.slug, "image_url": v.image_url} for v in venues],
        "total": len(venues)
    }


@router.get("/following/groups")
def get_followed_groups(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get all groups/organizers the current user follows.
    """
    from app.core.utils import normalize_uuid
    import logging
    logger = logging.getLogger(__name__)
    
    follows = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.target_type == "group"
        )
    ).all()
    
    logger.info(f"User {current_user.id} has {len(follows)} group follows")
    
    if not follows:
        return {"groups": [], "total": 0}
    
    # Normalize UUIDs to handle format differences
    group_ids = [normalize_uuid(f.target_id) for f in follows]
    logger.info(f"Looking for groups with IDs: {group_ids}")
    
    groups = session.exec(
        select(Organizer).where(Organizer.id.in_(group_ids))
    ).all()
    
    logger.info(f"Found {len(groups)} matching groups")
    
    return {
        "groups": [{"id": g.id, "name": g.name, "slug": g.slug, "logo_url": g.logo_url} for g in groups],
        "total": len(groups)
    }
