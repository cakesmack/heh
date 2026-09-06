from __future__ import annotations
from typing import Any, Dict, List, Optional, Union, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from pydantic import BaseModel
import logging

from app.core.database import get_session
from app.core.config import settings
from app.core.utils import simple_slugify, normalize_uuid
from app.api.auth import get_current_user
from app.models import User, Organizer, OrganizerStripeAccount
from app.models.group_member import GroupMember
from app.services import stripe_service

router = APIRouter()
logger = logging.getLogger(__name__)

class OnboardRequest(BaseModel):
    organizer_id: Optional[str] = None
    return_url: Optional[str] = None
    refresh_url: Optional[str] = None

@router.post("/request-access")
@router.post("/request-access/")
def request_seller_access(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Request access to become an event seller. Immediately auto-approves the user for seller capability.
    """
    current_user.seller_tier = 2
    if current_user.seller_status not in ["frozen", "rejected"]:
        current_user.seller_status = "approved"
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return {
        "message": "Seller access activated successfully.",
        "seller_tier": current_user.seller_tier,
        "seller_status": current_user.seller_status
    }

@router.get("/status")
@router.get("/status/")
@router.get("/stripe-connect/status")
@router.get("/stripe-connect/status/")
def get_seller_status(
    organizer_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Get the current user's seller tier, approval status, and linked Stripe account status.
    If organizer_id is provided, targets that specific Organizer/Group profile.
    Automatically syncs live status with Stripe if an account exists.
    """
    organizers = session.exec(select(Organizer).where(Organizer.user_id == current_user.id)).all()
    
    # Attempt to sync Stripe account status if connected
    for org in organizers:
        if org.stripe_account:
            try:
                stripe_service.sync_account_status(org.stripe_account.stripe_account_id, session)
            except Exception as e:
                logger.warning(f"Could not auto-sync Stripe account {org.stripe_account.stripe_account_id}: {e}")
                
    session.refresh(current_user)
    
    # Target entity selection
    target_organizer: Optional[Organizer] = None
    clean_org_id = (organizer_id or "").strip()
    if clean_org_id.lower() in ("", "null", "undefined", "none"):
        clean_org_id = None

    if clean_org_id:
        norm_org_id = normalize_uuid(clean_org_id)
        target_organizer = next((o for o in organizers if o.id == clean_org_id or o.id == norm_org_id or o.slug == clean_org_id), None)
        if not target_organizer:
            target_organizer = session.get(Organizer, clean_org_id) or session.get(Organizer, norm_org_id)
            if not target_organizer:
                target_organizer = session.exec(select(Organizer).where(Organizer.slug == clean_org_id)).first()
            if target_organizer and target_organizer.user_id != current_user.id and not current_user.is_admin:
                is_member = session.exec(
                    select(GroupMember).where(
                        GroupMember.group_id == target_organizer.id,
                        GroupMember.user_id == current_user.id
                    )
                ).first() is not None
                if not is_member:
                    target_organizer = None
    else:
        target_organizer = organizers[0] if organizers else None
        
    stripe_info = None
    if target_organizer and target_organizer.stripe_account:
        stripe_info = {
            "stripe_account_id": target_organizer.stripe_account.stripe_account_id,
            "charges_enabled": target_organizer.stripe_account.charges_enabled,
            "payouts_enabled": target_organizer.stripe_account.payouts_enabled
        }
        
    charges_enabled = bool(stripe_info and stripe_info.get("charges_enabled"))
    payouts_enabled = bool(stripe_info and stripe_info.get("payouts_enabled"))
    is_connected = bool(stripe_info and stripe_info.get("stripe_account_id"))

    return {
        "seller_tier": current_user.seller_tier,
        "seller_status": current_user.seller_status,
        "is_connected": is_connected,
        "charges_enabled": charges_enabled,
        "payouts_enabled": payouts_enabled,
        "organizer_id": target_organizer.id if target_organizer else (organizer_id or None),
        "organizer_name": target_organizer.name if target_organizer else None,
        "stripe_account": stripe_info,
        "organizers": [
            {
                "id": o.id,
                "name": o.name,
                "slug": o.slug,
                "stripe_account": {
                    "stripe_account_id": o.stripe_account.stripe_account_id,
                    "charges_enabled": o.stripe_account.charges_enabled,
                    "payouts_enabled": o.stripe_account.payouts_enabled
                } if o.stripe_account else None
            }
            for o in organizers
        ]
    }

def resolve_or_create_organizer(
    session: Session,
    current_user: User,
    target_organizer_id: Optional[str] = None
) -> Organizer:
    """
    Resolve an Organizer profile for the given user, or auto-create one if needed.
    - Sanitizes input: empty strings, 'null', 'undefined', 'none' are treated as None.
    - Flexible lookup: searches by primary key (as-is and unhyphenated) and by slug.
    - Ownership / authorization:
      - If unassigned (user_id is None), links it to current_user.
      - If owned by current_user or current_user is admin, returns it.
      - If user is a member of the group (GroupMember), returns it.
      - If unowned and user lacks access, logs a warning and falls back to user's personal profile.
    - Auto-creation fallback:
      - Looks for an existing Organizer owned by current_user.
      - If none exists, creates a new Organizer profile with a collision-resistant unique slug.
    """
    from uuid import uuid4

    clean_id = (target_organizer_id or "").strip()
    if clean_id.lower() in ("", "null", "undefined", "none"):
        clean_id = None

    organizer: Optional[Organizer] = None

    if clean_id:
        organizer = session.get(Organizer, clean_id)
        if not organizer:
            norm_id = normalize_uuid(clean_id)
            if norm_id != clean_id:
                organizer = session.get(Organizer, norm_id)
        if not organizer:
            organizer = session.exec(select(Organizer).where(Organizer.slug == clean_id)).first()

        if organizer:
            # If organizer profile has no owner, claim it for current_user
            if not organizer.user_id:
                organizer.user_id = current_user.id
                session.add(organizer)
                session.commit()
                session.refresh(organizer)
                return organizer

            is_owner = (organizer.user_id == current_user.id)
            is_admin = bool(current_user.is_admin)
            is_member = False
            if not is_owner and not is_admin:
                member_record = session.exec(
                    select(GroupMember).where(
                        GroupMember.group_id == organizer.id,
                        GroupMember.user_id == current_user.id
                    )
                ).first()
                is_member = (member_record is not None)

            if is_owner or is_admin or is_member:
                return organizer

            logger.warning(
                f"User {current_user.id} requested organizer {organizer.id} ({organizer.slug}) "
                f"without owner, admin, or group member permissions. Falling back to personal organizer."
            )
            organizer = None
        else:
            logger.warning(
                f"Requested organizer '{clean_id}' by user {current_user.id} was not found in the database. "
                f"Falling back to user's personal organizer."
            )

    # Fallback to existing personal organizer
    organizer = session.exec(select(Organizer).where(Organizer.user_id == current_user.id)).first()
    if organizer:
        return organizer

    # Auto-create new organizer profile for user
    base_name = current_user.username or (current_user.email.split("@")[0] if current_user.email else "Organizer")
    base_slug = simple_slugify(base_name) or "organizer"
    slug_candidate = f"{base_slug}-{current_user.id[:6]}"

    existing_slug = session.exec(select(Organizer).where(Organizer.slug == slug_candidate)).first()
    if existing_slug:
        slug_candidate = f"{base_slug}-{uuid4().hex[:8]}"

    organizer = Organizer(
        name=base_name,
        slug=slug_candidate,
        user_id=current_user.id
    )
    session.add(organizer)
    session.commit()
    session.refresh(organizer)
    logger.info(f"Auto-created Organizer profile {organizer.id} ({organizer.slug}) for user {current_user.id}")
    return organizer


@router.post("/stripe-connect/onboard")
@router.post("/stripe-connect/onboard/")
def onboard_stripe_connect(
    organizer_id: Optional[str] = Query(None),
    return_url: Optional[str] = Query(None),
    refresh_url: Optional[str] = Query(None),
    body: Optional[OnboardRequest] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a Stripe Connect account (if needed) and return the onboarding link.
    Supports targeting a group via organizer_id and customizing return/refresh URLs.
    """
    target_organizer_id = organizer_id or (body.organizer_id if body else None)
    custom_return = return_url or (body.return_url if body else None)
    custom_refresh = refresh_url or (body.refresh_url if body else None)

    # Auto-approve seller tier if initiating Stripe Connect onboarding
    if current_user.seller_tier < 2 or current_user.seller_status != "approved":
        current_user.seller_tier = 2
        current_user.seller_status = "approved"
        session.add(current_user)
        session.commit()
        session.refresh(current_user)

    # Find or auto-create organizer profile
    organizer = resolve_or_create_organizer(session, current_user, target_organizer_id)

    stripe_account = organizer.stripe_account
    
    # Create Stripe Account if it doesn't exist
    if not stripe_account:
        try:
            account_id = stripe_service.create_connect_account(email=current_user.email)
            stripe_account = OrganizerStripeAccount(
                organizer_profile_id=organizer.id,
                stripe_account_id=account_id
            )
            session.add(stripe_account)
            session.commit()
            session.refresh(stripe_account)
        except Exception as e:
            logger.error(f"Failed to create Stripe Connect account for organizer {organizer.id} (user {current_user.id}): {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create Stripe account: {str(e)}")
            
    # Generate Onboarding Link
    base_url = settings.FRONTEND_URL.rstrip("/")
    resolved_refresh = custom_refresh or f"{base_url}/organizers/payouts"
    resolved_return = custom_return or f"{base_url}/organizers/payouts"
    
    try:
        onboarding_url = stripe_service.create_account_onboarding_link(
            stripe_account_id=stripe_account.stripe_account_id,
            refresh_url=resolved_refresh,
            return_url=resolved_return
        )
        return {"url": onboarding_url}
    except Exception as e:
        logger.error(f"Failed to generate Stripe onboarding link for account {stripe_account.stripe_account_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create onboarding link: {str(e)}")

@router.get("/stripe-connect/dashboard-link")
@router.get("/stripe-connect/dashboard-link/")
def get_stripe_dashboard_link(
    organizer_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get the Stripe Express/Standard dashboard URL for the connected account.
    """
    organizer = resolve_or_create_organizer(session, current_user, organizer_id)
    stripe_account = organizer.stripe_account
    if not stripe_account or not stripe_account.stripe_account_id:
        logger.warning(
            f"Stripe dashboard link requested but no connected account found. "
            f"user_id={current_user.id}, organizer_id={organizer.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Stripe account connected."
        )
        
    return {"url": "https://dashboard.stripe.com/"}


@router.get("/invoices")
@router.get("/invoices/")
def get_seller_invoices_route(
    event_id: Optional[str] = None,
    tax_year: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Returns platform fee line items and net payout summaries for the organizer's events.
    """
    from app.api.organizer_ticketing import get_organizer_invoices
    return get_organizer_invoices(event_id=event_id, tax_year=tax_year, current_user=current_user, session=session)

