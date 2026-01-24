from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid, simple_slugify
from app.models.user import User
from app.models.organizer import Organizer
from app.models.event import Event
from app.models.follow import Follow
from app.models.group_member import GroupMember, GroupRole
from app.schemas.organizer import (
    OrganizerCreate,
    OrganizerUpdate,
    OrganizerResponse,
    OrganizerListResponse
)

router = APIRouter(tags=["Organizers"])

@router.get("", response_model=OrganizerListResponse)
def list_organizers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    user_id: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    List organizers with optional filtering.
    """
    query = select(Organizer)
    
    if user_id:
        from sqlmodel import or_
        user_uuid = normalize_uuid(user_id)
        
        # Subquery for memberships
        member_subquery = select(GroupMember.group_id).where(GroupMember.user_id == user_uuid)
        
        query = query.where(
            or_(
                Organizer.user_id == user_uuid,
                Organizer.id.in_(member_subquery)
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()
    
    # Pagination
    query = query.offset(skip).limit(limit)
    organizers = session.exec(query).all()
    
    return OrganizerListResponse(
        organizers=organizers,
        total=total
    )

@router.post("", response_model=OrganizerResponse, status_code=status.HTTP_201_CREATED)
def create_organizer(
    organizer_data: OrganizerCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a new organizer profile.
    """
    # Generate slug
    slug = simple_slugify(organizer_data.name)
    
    # Check uniqueness
    existing = session.exec(select(Organizer).where(Organizer.slug == slug)).first()
    if existing:
        # Append random 4 chars
        import random
        import string
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
        slug = f"{slug}-{suffix}"
    
    new_organizer = Organizer(
        **organizer_data.model_dump(),
        slug=slug,
        user_id=current_user.id
    )
    
    session.add(new_organizer)
    session.commit()
    session.refresh(new_organizer)
    
    return new_organizer

@router.get("/slug/{slug}", response_model=OrganizerResponse)
def get_organizer_by_slug(
    slug: str,
    session: Session = Depends(get_session)
):
    """
    Get a specific organizer by slug with computed stats.
    """
    organizer = session.exec(select(Organizer).where(Organizer.slug == slug)).first()
    if not organizer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer not found"
        )
    
    # Compute total events hosted (past events only)
    total_events = session.exec(
        select(func.count()).select_from(Event).where(
            Event.organizer_profile_id == organizer.id,
            Event.date_end < datetime.utcnow(),
            Event.status == "published"
        )
    ).one() or 0
    
    # Compute follower count
    follower_count = session.exec(
        select(func.count()).select_from(Follow).where(
            Follow.target_id == organizer.id,
            Follow.target_type == "group"
        )
    ).one() or 0
    
    # Build response with computed fields
    response_data = OrganizerResponse.model_validate(organizer)
    response_data.total_events_hosted = total_events
    response_data.follower_count = follower_count
    
    return response_data

@router.get("/{organizer_id}", response_model=OrganizerResponse)
def get_organizer(
    organizer_id: str,
    session: Session = Depends(get_session)
):
    """
    Get a specific organizer by ID.
    """
    organizer = session.get(Organizer, normalize_uuid(organizer_id))
    if not organizer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer not found"
        )
    return organizer

@router.put("/{organizer_id}", response_model=OrganizerResponse)
def update_organizer(
    organizer_id: str,
    organizer_data: OrganizerUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update an organizer profile.
    """
    organizer = session.get(Organizer, normalize_uuid(organizer_id))
    if not organizer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer not found"
        )
    
    # Check permissions - OWNER, ADMIN, or site admin can update
    is_creator = organizer.user_id == current_user.id
    is_site_admin = current_user.is_admin
    
    if not is_creator and not is_site_admin:
        # Check if user is OWNER or ADMIN via GroupMember
        member = session.exec(
            select(GroupMember).where(
                GroupMember.group_id == organizer.id,
                GroupMember.user_id == current_user.id,
                GroupMember.role.in_([GroupRole.OWNER, GroupRole.ADMIN])
            )
        ).first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this organizer"
            )
        
    update_data = organizer_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(organizer, key, value)
        
    session.add(organizer)
    session.commit()
    session.refresh(organizer)
    
    return organizer

@router.delete("/{organizer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organizer(
    organizer_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Delete an organizer profile.
    """
    organizer = session.get(Organizer, normalize_uuid(organizer_id))
    if not organizer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer not found"
        )
    
    # Check permissions - Only OWNER (creator) or site admin can delete
    if organizer.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can delete this organizer"
        )
        
    # Manual Cascade Delete for related records
    # 1. Delete Members
    from app.models.group_member import GroupMember
    session.exec(select(GroupMember).where(GroupMember.group_id == organizer_id))
    # We need to delete them individually or use delete statements if supported by SQLModel/SQLAlchemy setup
    # Using direct delete statements is more efficient
    from sqlalchemy import delete
    session.exec(delete(GroupMember).where(GroupMember.group_id == organizer_id))
    
    # 2. Delete Invites
    from app.models.group_invite import GroupInvite
    session.exec(delete(GroupInvite).where(GroupInvite.group_id == organizer_id))
    
    # 3. Delete Follows
    from app.models.follow import Follow
    session.exec(delete(Follow).where(Follow.target_id == organizer_id, Follow.target_type == "group"))

    # 4. Delete Organizer
    session.delete(organizer)
    session.commit()
    return None
