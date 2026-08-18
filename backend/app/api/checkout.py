from __future__ import annotations
import json
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Tuple
import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select
import logging

from app.core.database import get_session
from app.core.config import settings
from app.core.utils import normalize_uuid
from app.models import Event, TicketTier, Order, Ticket, PromoCode
from app.services import fee_service, promo_service

router = APIRouter()
logger = logging.getLogger(__name__)

class CheckoutItem(BaseModel):
    tier_id: str
    quantity: int

class CheckoutRequest(BaseModel):
    event_id: str
    items: List[CheckoutItem]
    buyer_email: EmailStr
    buyer_name: str
    buyer_phone: Optional[str] = None
    promo_code: Optional[str] = None
    attendee_responses: Optional[dict] = None

def generate_order_ref() -> str:
    # Generates a reference like HEH-A1B2C3
    return "HEH-" + secrets.token_hex(3).upper()

def generate_qr_token() -> str:
    return secrets.token_urlsafe(48)

class PromoValidationRequest(BaseModel):
    code: str

@router.get("/intent-status/{intent_id}")
@router.get("/intent-status/{intent_id}/")
def get_order_by_intent(
    intent_id: str,
    stripe_account_id: Optional[str] = Query(None),
    event_id: Optional[str] = Query(None),
    session: Session = Depends(get_session)
):
    # 1. First check local database: if an Order already exists, return immediately without calling Stripe
    order = session.exec(select(Order).where(Order.stripe_payment_intent_id == intent_id)).first()
    if order:
        return {
            "status": "succeeded",
            "order_ref": order.order_ref
        }

    # If event_id is provided but not stripe_account_id, resolve it from event
    resolved_stripe_account = stripe_account_id
    if not resolved_stripe_account and event_id:
        from app.models.organizer_stripe_account import OrganizerStripeAccount
        from app.models.organizer import Organizer
        event = session.get(Event, normalize_uuid(event_id)) or session.get(Event, event_id)
        if event and event.organizer_profile and event.organizer_profile.stripe_account:
            resolved_stripe_account = event.organizer_profile.stripe_account.stripe_account_id
        elif event and event.organizer_id:
            stmt = (
                select(OrganizerStripeAccount)
                .join(Organizer, OrganizerStripeAccount.organizer_profile_id == Organizer.id)
                .where(Organizer.user_id == event.organizer_id)
            )
            acc = session.exec(stmt).first()
            if acc:
                resolved_stripe_account = acc.stripe_account_id

    # 2. Polling fallback: check with Stripe directly if webhook was delayed
    try:
        from app.services.stripe_service import fulfill_payment_intent
        order = fulfill_payment_intent(intent_id, session, stripe_account_id=resolved_stripe_account)
        if order:
            return {
                "status": "succeeded",
                "order_ref": order.order_ref
            }
    except Exception as e:
        logger.warning(f"Error checking Stripe status for intent {intent_id}: {e}")

    return {"status": "processing"}

@router.get("/orders/{order_ref}")
@router.get("/orders/{order_ref}/")
def get_order(order_ref: str, session: Session = Depends(get_session)):
    order = session.exec(select(Order).where(Order.order_ref == order_ref)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    event = order.event
    venue_name = ""
    venue_address = ""
    venue_town = ""
    organizer_name = ""
    
    if event:
        if event.venue:
            venue_name = event.venue.name or ""
            venue_address = getattr(event.venue, "formatted_address", None) or event.venue.address or ""
            venue_town = getattr(event, "location_town", "") or ""
        else:
            venue_name = event.location_name or ""
            venue_town = getattr(event, "location_town", "") or ""
            venue_address = event.location_address or ""
            
        if event.organizer_profile and event.organizer_profile.name:
            organizer_name = event.organizer_profile.name
        elif event.organizer_id:
            from app.models.user import User
            org_user = session.get(User, event.organizer_id)
            if org_user:
                organizer_name = org_user.username or org_user.email
        if not organizer_name:
            organizer_name = "Highland Event Host"

    tickets_out = []
    for t in order.tickets:
        tickets_out.append({
            "id": t.id,
            "qr_token": t.qr_token,
            "tier_id": t.tier_id,
            "tier_name": t.tier.name if t.tier else "General Admission",
            "tier_price": t.tier.price if t.tier else 0.0,
            "status": t.status,
        })
        
    return {
        "order_ref": order.order_ref,
        "event_id": order.event_id,
        "event_title": event.title if event else "Event",
        "event_start": event.date_start if event else None,
        "event_end": event.date_end if event else None,
        "venue_name": venue_name,
        "venue_address": venue_address,
        "venue_town": venue_town,
        "organizer_name": organizer_name,
        "buyer_name": order.buyer_name,
        "buyer_email": order.buyer_email,
        "total_amount": order.total_amount,
        "platform_fee_amount": order.platform_fee_amount,
        "status": order.status,
        "created_at": order.created_at,
        "tickets": tickets_out
    }

@router.post("/events/{event_id}/validate-promo")
@router.post("/events/{event_id}/validate-promo/")
def validate_promo(event_id: str, request: PromoValidationRequest, session: Session = Depends(get_session)):
    # Dual lookup: try slug, then normalized UUID, then raw ID
    event = session.exec(select(Event).where(Event.slug == event_id)).first()
    if not event:
        event = session.get(Event, normalize_uuid(event_id))
    if not event:
        event = session.get(Event, event_id)
        
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    try:
        promo = promo_service.validate_promo_code(event.id, request.code, session)
        return {
            "valid": True,
            "discount_type": promo.discount_type,
            "discount_value": promo.discount_value,
            "target_tier_id": promo.target_tier_id
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/create-payment-intent")
@router.post("/create-payment-intent/")
def create_payment_intent(
    request: CheckoutRequest,
    session: Session = Depends(get_session)
):
    """
    Creates a Stripe PaymentIntent for the checkout or processes a free order immediately.
    """
    if not request.items:
        raise HTTPException(status_code=400, detail="Cart is empty.")

    # 1. Validate Event & Organizer
    event = session.exec(select(Event).where(Event.slug == request.event_id)).first()
    if not event:
        event = session.get(Event, normalize_uuid(request.event_id))
    if not event:
        event = session.get(Event, request.event_id)

    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
        
    if not event.is_ticketing_enabled or event.sales_frozen:
        raise HTTPException(status_code=400, detail="Sales are not active for this event.")
        
    # Resolve organizer Stripe account
    from app.models.organizer_stripe_account import OrganizerStripeAccount
    from app.models.organizer import Organizer

    stripe_account = None
    if event.organizer_profile and event.organizer_profile.stripe_account and event.organizer_profile.stripe_account.charges_enabled:
        stripe_account = event.organizer_profile.stripe_account
    elif event.organizer_id:
        stmt = (
            select(OrganizerStripeAccount)
            .join(Organizer, OrganizerStripeAccount.organizer_profile_id == Organizer.id)
            .where(Organizer.user_id == event.organizer_id, OrganizerStripeAccount.charges_enabled == True)
        )
        stripe_account = session.exec(stmt).first()

    if not stripe_account:
        raise HTTPException(status_code=400, detail="Organizer is not ready to accept payments.")
        
    stripe_account_id = stripe_account.stripe_account_id

    # 2. Promo Code Validation
    promo = None
    if request.promo_code:
        try:
            promo = promo_service.validate_promo_code(event.id, request.promo_code, session)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # 3. Lock & Validate Inventory
    tier_ids = [item.tier_id for item in request.items]
    
    # We use with_for_update() to lock these rows during the transaction
    statement = select(TicketTier).where(TicketTier.id.in_(tier_ids)).with_for_update()
    tiers = session.exec(statement).all()
    tier_map = {t.id: t for t in tiers}
    
    tier_items = []
    now = datetime.utcnow()
    
    for item in request.items:
        tier = tier_map.get(item.tier_id)
        if not tier or tier.event_id != event.id:
            raise HTTPException(status_code=400, detail=f"Invalid tier ID: {item.tier_id}")
            
        if item.quantity > tier.max_per_order:
            raise HTTPException(status_code=400, detail=f"Cannot order more than {tier.max_per_order} for {tier.name}.")
            
        if tier.quantity_sold + item.quantity > tier.quantity_available:
            raise HTTPException(status_code=400, detail=f"Not enough tickets available for {tier.name}.")
            
        if tier.sale_start and now < tier.sale_start:
            raise HTTPException(status_code=400, detail=f"Sales for {tier.name} have not started.")
            
        if tier.sale_end and now > tier.sale_end:
            raise HTTPException(status_code=400, detail=f"Sales for {tier.name} have ended.")
            
        # Target tier promo validation
        if promo and promo.target_tier_id and promo.target_tier_id != tier.id:
             raise HTTPException(status_code=400, detail="Promo code is not applicable to selected tiers.")
             
        tier_items.append((tier, item.quantity))

    # 4. Calculate Fees
    fee_breakdown = fee_service.calculate_order_fees(event, tier_items, promo, session)
    
    # 5. Handle Free Orders
    if fee_breakdown.gross_amount <= 0.0:
        # Fulfill instantly
        order_ref = generate_order_ref()
        # Prevent collisions (extremely rare but good practice)
        while session.exec(select(Order).where(Order.order_ref == order_ref)).first():
            order_ref = generate_order_ref()
            
        buyer_email_clean = (request.buyer_email or "").strip().lower()
        from app.models.user import User
        from sqlalchemy import func
        matching_user = session.exec(select(User).where(func.lower(User.email) == buyer_email_clean)).first()
        buyer_user_id = matching_user.id if matching_user else None

        order = Order(
            order_ref=order_ref,
            event_id=event.id,
            buyer_user_id=buyer_user_id,
            buyer_email=request.buyer_email,
            buyer_name=request.buyer_name,
            buyer_phone=request.buyer_phone,
            total_amount=0.0,
            platform_fee_amount=0.0,
            status="completed",
            attendee_responses=request.attendee_responses
        )
        session.add(order)
        session.flush() # get order.id
        
        # Create tickets & decrement inventory
        for tier, qty in tier_items:
            tier.quantity_sold += qty
            session.add(tier)
            for _ in range(qty):
                ticket = Ticket(
                    order_id=order.id,
                    tier_id=tier.id,
                    qr_token=generate_qr_token(),
                    status="valid"
                )
                session.add(ticket)
                
        if promo:
            promo.usage_count += 1
            session.add(promo)
            
        session.commit()
        
        # Dispatch email and notification for free order
        from app.services.stripe_service import trigger_order_confirmation_emails
        trigger_order_confirmation_emails(order, session)

        return {"free_order": True, "order_ref": order.order_ref}

    # 6. Handle Paid Orders
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured.")
        
    stripe.api_key = settings.STRIPE_SECRET_KEY
    items_payload = [item.dict() for item in request.items]
    
    buyer_email_clean = (request.buyer_email or "").strip().lower()
    from app.models.user import User
    from sqlalchemy import func
    matching_user = session.exec(select(User).where(func.lower(User.email) == buyer_email_clean)).first()
    buyer_user_id = matching_user.id if matching_user else ""

    try:
        intent = stripe.PaymentIntent.create(
            amount=int(round(fee_breakdown.gross_amount * 100)), # in pence
            currency="gbp",
            application_fee_amount=int(round(fee_breakdown.platform_fee_amount * 100)),
            receipt_email=request.buyer_email,
            metadata={
                "event_id": event.id,
                "buyer_user_id": buyer_user_id,
                "buyer_name": request.buyer_name,
                "buyer_email": request.buyer_email,
                "buyer_phone": request.buyer_phone or "",
                "items_json": json.dumps(items_payload),
                "promo_code": request.promo_code or "",
                "attendee_responses": json.dumps(request.attendee_responses or {})
            },
            stripe_account=stripe_account_id
        )
        
        # We DO NOT save the order yet. It will be saved in the webhook upon success.
        # This prevents empty/abandoned orders from holding inventory.
        session.commit() # Commit any implicit locks (release them so others can buy)
        
        return {
            "client_secret": intent.client_secret,
            "stripe_account_id": stripe_account_id,
            "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
            "amount": fee_breakdown.gross_amount,
            "gross_amount": fee_breakdown.gross_amount,
            "subtotal_amount": fee_breakdown.subtotal_amount,
            "platform_fee": fee_breakdown.platform_fee_amount,
            "platform_fee_amount": fee_breakdown.platform_fee_amount,
            "pass_fees_to_buyer": fee_breakdown.pass_fees_to_buyer
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e.user_message or e))
    except Exception as e:
        logger.error(f"Unexpected checkout error: {e}")
        raise HTTPException(status_code=500, detail="Checkout failed")
