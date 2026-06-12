from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.follow import Follow
from app.models.venue import Venue
from app.models.organizer import Organizer

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
    from app.core.utils import normalize_uuid
    import uuid
    import logging
    logger = logging.getLogger(__name__)

    if target_type not in ["venue", "group"]:
        raise HTTPException(status_code=400, detail="Invalid target type. Must be 'venue' or 'group'.")

    logger.info(f"follow_target: {target_type} {target_id} user={current_user.id}")

    # 1. Find the target object first
    target = None
    
    # Try exact match
    if target_type == "venue":
        target = session.get(Venue, target_id)
    else:
        target = session.get(Organizer, target_id)
        
    # Try normalized match (no dashes) if failed
    if not target:
        normalized_id = normalize_uuid(target_id)
        if normalized_id != target_id:
            if target_type == "venue":
                target = session.get(Venue, normalized_id)
            else:
                target = session.get(Organizer, normalized_id)
    
    # Try dashed match if failed
    if not target:
        try:
            dashed_id = str(uuid.UUID(hex=normalize_uuid(target_id)))
            if dashed_id != target_id:
                if target_type == "venue":
                    target = session.get(Venue, dashed_id)
                else:
                    target = session.get(Organizer, dashed_id)
        except ValueError:
            pass

    if not target:
        logger.warning(f"Target not found: {target_type} {target_id}")
        raise HTTPException(status_code=404, detail=f"{target_type.capitalize()} not found")

    # 2. Check if already following (using the Found Target's ID to match DB usage)
    # AND also check the input ID just in case existing data is mixed
    
    # Search for existing follow by matching against target.id (trust the DB object id)
    existing_follow = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.target_id == target.id
        )
    ).first()

    if existing_follow:
        return existing_follow

    # Create follow using the TRUE database key of the target
    follow = Follow(
        follower_id=current_user.id,
        target_id=target.id,
        target_type=target_type
    )
    session.add(follow)
    session.commit()
    session.refresh(follow)
    
    logger.info(f"Created follow: {follow.id}")
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
    from app.core.utils import normalize_uuid
    import uuid
    
    # Helper to find follow record
    def find_follow(tid):
        return session.exec(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.target_id == tid
            )
        ).first()

    # 1. Try exact match
    follow = find_follow(target_id)

    # 2. Try normalized (no dashes)
    if not follow:
        normalized_id = normalize_uuid(target_id)
        if normalized_id != target_id:
            follow = find_follow(normalized_id)
            
    # 3. Try dashed
    if not follow:
        try:
            dashed_id = str(uuid.UUID(hex=normalize_uuid(target_id)))
            follow = find_follow(dashed_id)
        except ValueError:
            pass

    if not follow:
        raise HTTPException(status_code=404, detail="Not following this target")

    session.delete(follow)
    session.commit()
    return {"ok": True}




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
        "venues": [{"id": v.id, "name": v.name, "image_url": v.image_url} for v in venues],
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


@router.get("/following/{target_id}", response_model=bool)
def check_is_following(
    target_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Check if current user follows a target.
    """
    from app.core.utils import normalize_uuid
    import uuid
    
    # 1. exact match
    follow = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.target_id == target_id
        )
    ).first()
    
    if follow:
        return True
        
    # 2. normalized (no dashes)
    normalized = normalize_uuid(target_id)
    if normalized != target_id:
        follow = session.exec(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.target_id == normalized
            )
        ).first()
        if follow:
            return True
            
    # 3. dashed
    try:
        dashed = str(uuid.UUID(hex=normalized))
        if dashed != target_id:
            follow = session.exec(
                select(Follow).where(
                    Follow.follower_id == current_user.id,
                    Follow.target_id == dashed
                )
            ).first()
            if follow:
                return True
    except ValueError:
        pass

    return False

