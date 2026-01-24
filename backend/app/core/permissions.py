from typing import List, Optional
from fastapi import HTTPException
from sqlmodel import Session, select
from app.models.user import User
from app.models.organizer import Organizer
from app.models.group_member import GroupMember, GroupRole

def get_user_group_role(
    session: Session,
    group_id: str,
    user_id: str,
    group: Optional[Organizer] = None,
    user: Optional[User] = None
) -> Optional[GroupRole]:
    """
    Get the user's role in a group.
    Returns the role if the user is a member, or OWNER if they're the creator.
    Global Admins are treated as OWNERs (God Mode).
    Returns None if the user has no access.
    """
    # God Mode Check: Global admins bypass role checks
    if user and user.is_admin:
        return GroupRole.OWNER
        
    if not user:
        user = session.get(User, user_id)
        if user and user.is_admin:
            return GroupRole.OWNER

    # Check if creator (legacy owner)
    if group and group.user_id == user_id:
        return GroupRole.OWNER
    
    # Check group_members table
    member = session.exec(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        )
    ).first()
    
    return member.role if member else None


def require_group_role(
    session: Session,
    group_id: str,
    user: User,
    allowed_roles: List[GroupRole],
    group: Optional[Organizer] = None
) -> GroupRole:
    """
    Verify user has one of the allowed roles. Raises 403 if not.
    Returns the user's role.
    Global Admins always pass this check as OWNERs.
    """
    # God Mode Check (Redundant but explicit for safety at the requirement level)
    if user.is_admin:
        return GroupRole.OWNER

    role = get_user_group_role(session, group_id, user.id, group, user)
    
    if role is None:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    if role not in allowed_roles:
        # One final check just in case (e.g. if logic above changes)
        if user.is_admin:
            return GroupRole.OWNER
            
        raise HTTPException(
            status_code=403,
            detail=f"Requires one of: {', '.join([r.value for r in allowed_roles])}"
        )
    
    return role
