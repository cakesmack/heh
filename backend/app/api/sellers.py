from __future__ import annotations
from typing import Any, Dict, List, Optional, Union, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from pydantic import BaseModel
import logging

from app.core.database import get_session
from app.core.config import settings
from app.core.utils import simple_slugify
from app.api.auth import get_current_user
from app.models import User, Organizer, OrganizerStripeAccount
from app.services import stripe_service

router = APIRouter()
logger = logging.getLogger(__name__)

class OnboardRequest(BaseModel):
    organizer_id: Optional[str] = None

@router.post("/request-access")
@router.post("/request-access/")
def request_seller_access(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Request access to become an event seller.
    """
    if current_user.seller_tier == 2 or current_user.seller_status == "approved":
        return {"message": "You are already an approved seller."}
        
    if current_user.seller_status == "requested":
        return {"message": "Your request is already pending review."}
        
    current_user.seller_status = "requested"
    session.add(current_user)
    session.commit()
    return {"message": "Seller access requested successfully."}

@router.get("/status")
@router.get("/status/")
@router.get("/stripe-connect/status")
@router.get("/stripe-connect/status/")
def get_seller_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Get the current user's seller tier, approval status, and linked Stripe account status.
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
    
    primary_organizer = organizers[0] if organizers else None
    stripe_info = None
    if primary_organizer and primary_organizer.stripe_account:
        stripe_info = {
            "stripe_account_id": primary_organizer.stripe_account.stripe_account_id,
            "charges_enabled": primary_organizer.stripe_account.charges_enabled,
            "payouts_enabled": primary_organizer.stripe_account.payouts_enabled
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
        "organizer_id": primary_organizer.id if primary_organizer else None,
        "organizer_name": primary_organizer.name if primary_organizer else None,
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

@router.post("/stripe-connect/onboard")
@router.post("/stripe-connect/onboard/")
def onboard_stripe_connect(
    organizer_id: Optional[str] = Query(None),
    body: Optional[OnboardRequest] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Create a Stripe Connect account (if needed) and return the onboarding link.
    """
    target_organizer_id = organizer_id or (body.organizer_id if body else None)
    
    # Auto-approve seller tier if initiating Stripe Connect onboarding
    if current_user.seller_tier < 2 or current_user.seller_status != "approved":
        current_user.seller_tier = 2
        current_user.seller_status = "approved"
        session.add(current_user)
        session.commit()
        session.refresh(current_user)

    # Find or auto-create organizer profile
    if target_organizer_id:
        organizer = session.get(Organizer, target_organizer_id)
        if not organizer or organizer.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organizer profile not found or not owned by you."
            )
    else:
        organizer = session.exec(select(Organizer).where(Organizer.user_id == current_user.id)).first()
        if not organizer:
            base_name = current_user.username or (current_user.email.split("@")[0] if current_user.email else "Organizer")
            slug = simple_slugify(base_name)
            organizer = Organizer(
                name=base_name,
                slug=f"{slug}-{current_user.id[:6]}",
                user_id=current_user.id
            )
            session.add(organizer)
            session.commit()
            session.refresh(organizer)

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
            logger.error(f"Failed to create Stripe Connect account: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create Stripe account: {str(e)}")
            
    # Generate Onboarding Link
    base_url = settings.FRONTEND_URL.rstrip("/")
    refresh_url = f"{base_url}/organizers/payouts"
    return_url = f"{base_url}/organizers/payouts"
    
    try:
        onboarding_url = stripe_service.create_account_onboarding_link(
            stripe_account_id=stripe_account.stripe_account_id,
            refresh_url=refresh_url,
            return_url=return_url
        )
        return {"url": onboarding_url}
    except Exception as e:
        logger.error(f"Failed to generate Stripe onboarding link: {e}")
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
    if organizer_id:
        organizer = session.get(Organizer, organizer_id)
    else:
        organizer = session.exec(select(Organizer).where(Organizer.user_id == current_user.id)).first()
        
    if not organizer or organizer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organizer profile not found or not owned by you."
        )
        
    stripe_account = organizer.stripe_account
    if not stripe_account:
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

