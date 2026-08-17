from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Dict, Any

from app.core.database import get_session
from app.api.admin import require_admin
from app.models import User, Organizer

router = APIRouter()

@router.get("/requests")
def list_seller_requests(
    current_admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    """
    List all users who have requested seller access.
    Returns user details along with any associated organizer profiles.
    """
    statement = select(User).where(User.seller_status == "requested")
    users = session.exec(statement).all()
    
    results = []
    for user in users:
        # Fetch associated organizer profiles
        organizers = session.exec(select(Organizer).where(Organizer.user_id == user.id)).all()
        organizer_data = [{"id": org.id, "name": org.name} for org in organizers]
        
        results.append({
            "user_id": user.id,
            "email": user.email,
            "username": user.username,
            "seller_status": user.seller_status,
            "seller_tier": user.seller_tier,
            "organizers": organizer_data,
            "requested_at": user.updated_at # Approximate
        })
        
    return results

@router.post("/{user_id}/approve")
def approve_seller(
    user_id: str,
    current_admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Approve a user for seller access (Tier 2).
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.seller_status = "approved"
    user.seller_tier = 2
    
    session.add(user)
    session.commit()
    
    return {"message": f"User {user.email} approved for seller access."}

@router.post("/{user_id}/reject")
def reject_seller(
    user_id: str,
    reason: str = None,
    current_admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Reject a user's seller access request.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.seller_status = "rejected"
    # Optional: Log the reason in admin_notes or a dedicated field
    if reason:
        user.admin_notes = f"{user.admin_notes or ''}\nSeller request rejected: {reason}".strip()
        
    session.add(user)
    session.commit()
    
    return {"message": f"User {user.email} seller request rejected."}
