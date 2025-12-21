from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.organizer import Organizer
from app.models.group_member import GroupMember, GroupRole
from app.models.group_invite import GroupInvite

router = APIRouter()

@router.post("/{group_id}/invite", response_model=GroupInvite)
def create_invite(
    group_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Generate an invite link for a group. Only owners can do this.
    """
    # Verify group exists
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Verify user is owner (either creator or has OWNER role)
    is_creator = group.user_id == current_user.id
    
    if not is_creator:
        member = session.exec(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
                GroupMember.role == GroupRole.OWNER
            )
        ).first()
        if not member:
            raise HTTPException(status_code=403, detail="Only owners can invite members")

    # Create invite
    invite = GroupInvite(group_id=group_id)
    session.add(invite)
    session.commit()
    session.refresh(invite)
    return invite

@router.post("/join/{token}")
def join_group(
    token: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Join a group using an invite token.
    """
    # Find invite
    invite = session.get(GroupInvite, token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite token")

    # Check expiry
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

    # Add member
    member = GroupMember(
        group_id=invite.group_id,
        user_id=current_user.id,
        role=GroupRole.EDITOR
    )
    session.add(member)
    
    # Delete invite (one-time use? Spec says "delete the invite token")
    # If we want reusable links, we shouldn't delete. 
    # Spec says: "On Click: Add user... delete the invite token". 
    # So it's one-time use.
    session.delete(invite)
    
    session.commit()
    
    return {"message": "Joined group successfully", "group_id": invite.group_id}

@router.get("/{group_id}/members", response_model=List[GroupMember])
def list_members(
    group_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    List members of a group. Visible to members only.
    """
    # Check if user is member or owner
    group = session.get(Organizer, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    if group.user_id != current_user.id:
        member = session.exec(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id
            )
        ).first()
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this group")

    members = session.exec(
        select(GroupMember).where(GroupMember.group_id == group_id)
    ).all()
    return members
