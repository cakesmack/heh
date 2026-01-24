from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from app.core.database import get_session
from app.core.security import get_current_user
from app.core.utils import normalize_uuid
from app.core.config import settings
from app.services.resend_email import resend_email_service
from app.models.user import User
from app.models.organizer import Organizer
from app.models.group_member import GroupMember, GroupRole
from app.models.group_invite import GroupInvite
from app.schemas.group_member import (
    GroupMemberResponse,
    GroupMemberRoleUpdate,
    GroupInviteResponse,
    GroupInviteCreate
)

router = APIRouter()


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
    Global Admins are treated as OWNERs.
    Returns None if the user has no access.
    """
    # Check global admin status first
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
    """
    role = get_user_group_role(session, group_id, user.id, group, user)
    
    if role is None:
        # Check explicitly for superuser fallback (redundant but safe)
        if user.is_admin:
            return GroupRole.OWNER
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Global admins bypass role checks (they are effectively OWNERs)
    if user.is_admin:
        return GroupRole.OWNER

    if role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Requires one of: {', '.join([r.value for r in allowed_roles])}"
        )
    
    return role


# =============================================================================
# INVITE ENDPOINTS
# =============================================================================

@router.post("/{group_id}/invite", response_model=GroupInviteResponse)
def create_invite(
    group_id: str,
    invite_request: Optional[GroupInviteCreate] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Generate an invite link for a group. OWNER or ADMIN can do this.
    """
    group_id = normalize_uuid(group_id)
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is OWNER or ADMIN
    require_group_role(
        session, group_id, current_user,
        [GroupRole.OWNER, GroupRole.ADMIN],
        group
    )

    # Create invite
    invite = GroupInvite(group_id=group_id)
    session.add(invite)
    session.commit()
    session.refresh(invite)
    
    # Send email if requested
    if invite_request and invite_request.email:
        invite_url = f"{settings.FRONTEND_URL.rstrip('/')}/join/group/{invite.token}"
        inviter_name = current_user.username or "A member"
        group_name = group.name
        
        print(f"Sending invite for group '{group_name}' from user '{current_user.username}'")
        
        resend_email_service.send_group_invite(
            to_email=invite_request.email,
            inviter_name=inviter_name,
            group_name=group_name,
            invite_url=invite_url
        )
        
    return invite


@router.get("/{group_id}/invites", response_model=List[GroupInviteResponse])
def list_invites(
    group_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    List pending invites for a group. OWNER or ADMIN can view.
    """
    group_id = normalize_uuid(group_id)
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    require_group_role(
        session, group_id, current_user,
        [GroupRole.OWNER, GroupRole.ADMIN],
        group
    )

    # Get non-expired invites
    invites = session.exec(
        select(GroupInvite).where(
            GroupInvite.group_id == group_id,
            GroupInvite.expires_at > datetime.utcnow()
        )
    ).all()
    return invites


@router.delete("/{group_id}/invites/{token}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invite(
    group_id: str,
    token: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Revoke an invite link. OWNER or ADMIN can do this.
    """
    group_id = normalize_uuid(group_id)
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    require_group_role(
        session, group_id, current_user,
        [GroupRole.OWNER, GroupRole.ADMIN],
        group
    )

    invite = session.get(GroupInvite, token)
    if not invite or invite.group_id != group_id:
        raise HTTPException(status_code=404, detail="Invite not found")

    session.delete(invite)
    session.commit()
    return None


@router.post("/join/{token}")
def join_group(
    token: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Join a group using an invite token.
    """
    invite = session.get(GroupInvite, token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite token")

    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invite token expired")

    # Check if already a member
    existing_member = session.exec(
        select(GroupMember).where(
            GroupMember.group_id == invite.group_id,
            GroupMember.user_id == current_user.id
        )
    ).first()

    if existing_member:
        return {"message": "Already a member", "group_id": invite.group_id}

    # Add member as EDITOR by default
    try:
        member = GroupMember(
            group_id=invite.group_id,
            user_id=current_user.id,
            role=GroupRole.EDITOR
        )
        session.add(member)
        
        # Delete invite (one-time use)
        session.delete(invite)
        
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail="Failed to join group")
    
    return {"message": "Joined group successfully", "group_id": invite.group_id}


# =============================================================================
# MEMBER ENDPOINTS
# =============================================================================

@router.get("/{group_id}/members", response_model=List[GroupMemberResponse])
def list_members(
    group_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    List members of a group with user details. Visible to all members.
    """
    group_id = normalize_uuid(group_id)
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Any member can view the member list
    require_group_role(
        session, group_id, current_user,
        [GroupRole.OWNER, GroupRole.ADMIN, GroupRole.EDITOR],
        group
    )

    # Get members with user details
    members = session.exec(
        select(GroupMember).where(GroupMember.group_id == group_id)
    ).all()

    # Enrich with user details
    result = []
    for member in members:
        user = session.get(User, member.user_id)
        result.append(GroupMemberResponse(
            group_id=member.group_id,
            user_id=member.user_id,
            role=member.role.value,
            joined_at=member.joined_at,
            user_email=user.email if user else None,
            user_username=user.username if user else None
        ))

    # Also include the creator as OWNER if not already in members
    creator_in_members = any(m.user_id == group.user_id for m in members)
    if not creator_in_members:
        creator = session.get(User, group.user_id)
        if creator:
            result.insert(0, GroupMemberResponse(
                group_id=group_id,
                user_id=group.user_id,
                role=GroupRole.OWNER.value,
                joined_at=group.created_at,
                user_email=creator.email,
                user_username=creator.username
            ))

    return result


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Remove a member from a group. OWNER or ADMIN can do this.
    Cannot remove the last owner or yourself if you're the only owner.
    """
    group_id = normalize_uuid(group_id)
    user_id = normalize_uuid(user_id)
    
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify caller is OWNER or ADMIN
    caller_role = require_group_role(
        session, group_id, current_user,
        [GroupRole.OWNER, GroupRole.ADMIN],
        group
    )

    # Cannot remove the group creator (original owner)
    if user_id == group.user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove the group creator"
        )

    # Find the member to remove
    member = session.exec(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        )
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # ADMIN cannot remove OWNER (unless caller is global admin)
    if caller_role == GroupRole.ADMIN and member.role == GroupRole.OWNER and not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admins cannot remove owners"
        )

    session.delete(member)
    session.commit()
    return None


@router.put("/{group_id}/members/{user_id}/role", response_model=GroupMemberResponse)
def update_member_role(
    group_id: str,
    user_id: str,
    role_update: GroupMemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Update a member's role. Only OWNER can do this.
    Cannot change the role of the group creator.
    """
    group_id = normalize_uuid(group_id)
    user_id = normalize_uuid(user_id)
    
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Only OWNER can change roles
    require_group_role(
        session, group_id, current_user,
        [GroupRole.OWNER],
        group
    )

    # Validate new role
    try:
        new_role = GroupRole(role_update.role.lower())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join([r.value for r in GroupRole])}"
        )

    # Cannot change the group creator's role
    if user_id == group.user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot change the role of the group creator"
        )

    # Find the member
    member = session.exec(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        )
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Update role
    member.role = new_role
    session.add(member)
    session.commit()
    session.refresh(member)

    # Return with user details
    user = session.get(User, member.user_id)
    return GroupMemberResponse(
        group_id=member.group_id,
        user_id=member.user_id,
        role=member.role.value,
        joined_at=member.joined_at,
        user_email=user.email if user else None,
        user_username=user.username if user else None
    )


# =============================================================================
# MEMBERSHIP CHECK ENDPOINT (for event creation permission)
# =============================================================================

@router.get("/{group_id}/membership")
def check_membership(
    group_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Check if current user is a member of the group and return their role.
    Used by event creation to verify permission.
    """
    group_id = normalize_uuid(group_id)
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    role = get_user_group_role(session, group_id, current_user.id, group, current_user)
    
    if role is None:
        return {"is_member": False, "role": None}
    
    return {"is_member": True, "role": role.value}

