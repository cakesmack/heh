from __future__ import annotations
from typing import Any, Dict, List, Optional, Union, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, or_
from sqlalchemy import func

from app.core.database import get_session
from app.api.admin import require_admin
from app.models import User, Organizer, OrganizerStripeAccount, Event

router = APIRouter()

@router.get("")
@router.get("/")
@router.get("/directory")
@router.get("/requests")
def list_sellers_directory(
    query: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    current_admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Seller Oversight & Moderation Directory:
    Lists all active, auto-verified, pending, and moderated sellers on the platform.
    """
    # Fetch all users who have seller tier >= 2, requested status, or linked organizer profiles
    user_stmt = select(User).where(
        or_(
            User.seller_tier >= 2,
            User.seller_status.in_(["approved", "requested", "rejected", "frozen"]),
            User.id.in_(select(Organizer.user_id))
        )
    ).order_by(User.created_at.desc())
    
    users = session.exec(user_stmt).all()
    
    sellers_data = []
    active_count = 0
    pending_count = 0
    frozen_count = 0
    connected_stripe_count = 0

    for user in users:
        organizers = session.exec(select(Organizer).where(Organizer.user_id == user.id)).all()
        organizer_list = []
        has_active_stripe = False

        for org in organizers:
            stripe_data = None
            if org.stripe_account:
                stripe_data = {
                    "stripe_account_id": org.stripe_account.stripe_account_id,
                    "charges_enabled": org.stripe_account.charges_enabled,
                    "payouts_enabled": org.stripe_account.payouts_enabled,
                }
                if org.stripe_account.charges_enabled or org.stripe_account.payouts_enabled:
                    has_active_stripe = True

            organizer_list.append({
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "is_verified": getattr(org, "is_verified", False),
                "stripe_account": stripe_data
            })

        if has_active_stripe:
            connected_stripe_count += 1

        # Determine seller display status
        if user.seller_status in ["frozen", "rejected"]:
            display_status = "frozen"
            status_label = "Privileges Revoked / Frozen"
            frozen_count += 1
        elif (user.seller_tier >= 2 and user.seller_status == "approved") or has_active_stripe:
            display_status = "active"
            status_label = "Active / Auto-Verified"
            active_count += 1
        else:
            display_status = "pending"
            status_label = "Pending Stripe Setup"
            pending_count += 1

        # Count events hosted by this user
        events_count = len(session.exec(select(Event.id).where(Event.organizer_id == user.id)).all())

        seller_item = {
            "user_id": user.id,
            "email": user.email,
            "username": user.username,
            "seller_status": user.seller_status,
            "seller_tier": user.seller_tier,
            "display_status": display_status,
            "status_label": status_label,
            "is_auto_verified": display_status == "active",
            "has_active_stripe": has_active_stripe,
            "organizers": organizer_list,
            "events_count": events_count,
            "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else None,
            "updated_at": user.updated_at.isoformat() if getattr(user, "updated_at", None) else None,
        }

        # Apply in-memory search and filter if requested
        if query:
            q_lower = query.lower()
            org_names = " ".join([o["name"].lower() for o in organizer_list])
            if (
                q_lower not in (user.email or "").lower()
                and q_lower not in (user.username or "").lower()
                and q_lower not in org_names
            ):
                continue

        if status_filter and status_filter != "all":
            if display_status != status_filter:
                continue

        sellers_data.append(seller_item)

    return {
        "sellers": sellers_data,
        "stats": {
            "total_sellers": len(users),
            "active_verified": active_count,
            "pending_setup": pending_count,
            "frozen_revoked": frozen_count,
            "connected_stripe": connected_stripe_count,
        }
    }


@router.post("/{user_id}/approve")
@router.post("/{user_id}/verify")
@router.post("/{user_id}/unfreeze")
def restore_or_approve_seller(
    user_id: str,
    current_admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Restore or approve selling privileges for a user and re-verify their organizer profiles.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.seller_status = "approved"
    user.seller_tier = 2
    session.add(user)

    # Mark all organizer profiles as verified
    organizers = session.exec(select(Organizer).where(Organizer.user_id == user.id)).all()
    for org in organizers:
        org.is_verified = True
        session.add(org)

    session.commit()

    return {
        "message": f"Seller privileges restored/approved for {user.email}.",
        "user_id": user.id,
        "seller_status": "approved",
        "seller_tier": 2
    }


@router.post("/{user_id}/reject")
@router.post("/{user_id}/freeze")
@router.post("/{user_id}/revoke")
def freeze_or_revoke_seller(
    user_id: str,
    reason: Optional[str] = None,
    current_admin: User = Depends(require_admin),
    session: Session = Depends(get_session)
):
    """
    Freeze or revoke selling privileges for a user (moderation action).
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.seller_status = "frozen"
    user.seller_tier = 1

    if reason and hasattr(user, "admin_notes"):
        user.admin_notes = f"{user.admin_notes or ''}\n[Moderation] Seller privileges frozen: {reason}".strip()

    session.add(user)

    # De-verify organizer profiles
    organizers = session.exec(select(Organizer).where(Organizer.user_id == user.id)).all()
    for org in organizers:
        org.is_verified = False
        session.add(org)

    session.commit()

    return {
        "message": f"Seller privileges revoked/frozen for {user.email}.",
        "user_id": user.id,
        "seller_status": "frozen",
        "seller_tier": 1
    }
