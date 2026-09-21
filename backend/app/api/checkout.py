from __future__ import annotations
import json
import hashlib
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Tuple
import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
import logging

from app.core.database import get_session
from app.core.config import settings
from app.core.ticketing import require_native_ticket_sales_enabled
from app.core.utils import normalize_uuid
from app.models import Event, TicketTier, Order, PromoCode
from app.services import fee_service, promo_service
from app.services.ticket_inventory import (
    consume_order_reservations,
    create_active_reservations,
    ensure_capacity,
    lock_ticket_tiers,
)

router = APIRouter()
logger = logging.getLogger(__name__)

class CheckoutItem(BaseModel):
    tier_id: str
    quantity: int = Field(ge=1)

class CheckoutRequest(BaseModel):
    checkout_attempt_id: str = Field(min_length=16, max_length=128)
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


def _checkout_payload_hash(
    request: CheckoutRequest,
    event_id: str,
    quantities: Dict[str, int],
) -> str:
    canonical = {
        "event_id": event_id,
        "items": [{"tier_id": tier_id, "quantity": quantities[tier_id]} for tier_id in sorted(quantities)],
        "buyer_email": request.buyer_email.strip().lower(),
        "buyer_name": request.buyer_name.strip(),
        "buyer_phone": (request.buyer_phone or "").strip(),
        "promo_code": (request.promo_code or "").strip().upper(),
        "attendee_responses": request.attendee_responses or {},
    }
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _existing_checkout_response(order: Order) -> Optional[dict]:
    if order.status == "completed":
        return {"order_completed": True, "order_ref": order.order_ref}
    if order.status not in {"initializing", "pending_payment"}:
        raise HTTPException(
            status_code=409,
            detail="This checkout attempt is no longer active. Start a new checkout attempt.",
        )
    return None


def _create_or_reuse_payment_intent(order: Order, session: Session) -> dict:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured.")

    completed = _existing_checkout_response(order)
    if completed:
        return completed

    order_id = order.id
    total_amount = order.total_amount
    platform_fee_amount = order.platform_fee_amount
    buyer_email = order.buyer_email
    order_ref = order.order_ref
    event_id = order.event_id
    connected_account_id = order.stripe_account_id
    # Attribute refreshes may have opened a transaction after the reservation
    # commit. End it before the network request; no database transaction or lock
    # is held while Stripe is contacted.
    session.rollback()

    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(round(total_amount * 100)),
            currency="gbp",
            application_fee_amount=int(round(platform_fee_amount * 100)),
            receipt_email=buyer_email,
            metadata={
                "ticket_order_id": order_id,
                "order_ref": order_ref,
                "event_id": event_id,
            },
            stripe_account=connected_account_id,
            idempotency_key=f"ticket-order:{order_id}",
        )
    except stripe.error.StripeError as exc:
        # Creation may have succeeded remotely even when the response is lost.
        # Keep the reservation active; retrying this checkout uses the same key.
        logger.warning("Stripe PaymentIntent creation unresolved for order %s: %s", order_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Payment setup is temporarily unresolved. Retry this checkout attempt; your reservation is retained.",
        )
    except Exception as exc:
        logger.warning("Unexpected PaymentIntent creation outcome for order %s: %s", order_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Payment setup is temporarily unresolved. Retry this checkout attempt; your reservation is retained.",
        )

    locked_order = session.exec(
        select(Order).where(Order.id == order_id).with_for_update()
    ).first()
    if not locked_order:
        raise HTTPException(status_code=409, detail="Checkout order no longer exists.")
    if locked_order.stripe_payment_intent_id not in (None, intent.id):
        session.rollback()
        raise HTTPException(status_code=409, detail="Checkout payment identity conflict.")
    locked_order.stripe_payment_intent_id = intent.id
    locked_order.updated_at = datetime.utcnow()
    session.add(locked_order)
    session.commit()

    return {
        "client_secret": intent.client_secret,
        "stripe_account_id": locked_order.stripe_account_id,
        "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
        "amount": locked_order.total_amount,
        "gross_amount": locked_order.total_amount,
        "subtotal_amount": locked_order.subtotal_amount,
        "platform_fee": locked_order.platform_fee_amount,
        "platform_fee_amount": locked_order.platform_fee_amount,
        "order_ref": locked_order.order_ref,
    }

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
    # 1. Completed local orders can return immediately. Pending orders still
    # require authoritative Stripe reconciliation.
    order = session.exec(select(Order).where(Order.stripe_payment_intent_id == intent_id)).first()
    if order and order.status == "completed":
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
        result = fulfill_payment_intent(intent_id, session, stripe_account_id=resolved_stripe_account)
        if result:
            return {
                "status": "succeeded",
                "order_ref": result.order.order_ref
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
        "is_cancelled": getattr(event, "is_cancelled", False) if event else False,
        "cancellation_reason": getattr(event, "cancellation_reason", None) if event else None,
        "cancelled_at": event.cancelled_at.isoformat() if (event and getattr(event, "cancelled_at", None)) else None,
        "previous_date_start": event.previous_date_start.isoformat() if (event and getattr(event, "previous_date_start", None)) else None,
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
    require_native_ticket_sales_enabled()

    if not request.items:
        raise HTTPException(status_code=400, detail="Cart is empty.")

    requested_quantities: Dict[str, int] = {}
    for item in request.items:
        requested_quantities[item.tier_id] = requested_quantities.get(item.tier_id, 0) + item.quantity

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

    payload_hash = _checkout_payload_hash(request, event.id, requested_quantities)
    existing_order = session.exec(
        select(Order).where(Order.checkout_attempt_id == request.checkout_attempt_id)
    ).first()
    if existing_order:
        if existing_order.checkout_payload_hash != payload_hash or existing_order.event_id != event.id:
            raise HTTPException(
                status_code=409,
                detail="This checkout attempt identifier was already used for different details.",
            )
        return _create_or_reuse_payment_intent(existing_order, session)
        
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

    buyer_email_clean = request.buyer_email.strip().lower()
    from app.models.user import User
    matching_user = session.exec(select(User).where(func.lower(User.email) == buyer_email_clean)).first()

    order_ref = generate_order_ref()
    while session.exec(select(Order).where(Order.order_ref == order_ref)).first():
        order_ref = generate_order_ref()

    # Insert the idempotency identity before locking inventory. A concurrent
    # retry waits on the unique key and then reuses the committed order.
    order = Order(
        order_ref=order_ref,
        event_id=event.id,
        buyer_user_id=matching_user.id if matching_user else None,
        buyer_email=str(request.buyer_email),
        buyer_name=request.buyer_name,
        buyer_phone=request.buyer_phone,
        total_amount=0.0,
        subtotal_amount=0.0,
        platform_fee_amount=0.0,
        checkout_attempt_id=request.checkout_attempt_id,
        checkout_payload_hash=payload_hash,
        stripe_account_id=stripe_account_id,
        promo_code=request.promo_code,
        status="initializing",
        attendee_responses=request.attendee_responses,
    )
    session.add(order)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        existing_order = session.exec(
            select(Order).where(Order.checkout_attempt_id == request.checkout_attempt_id)
        ).first()
        if not existing_order or existing_order.checkout_payload_hash != payload_hash:
            raise HTTPException(status_code=409, detail="Checkout attempt conflict.")
        return _create_or_reuse_payment_intent(existing_order, session)

    # 3. Lock & validate inventory in deterministic tier order.
    tier_map = lock_ticket_tiers(session, requested_quantities)
    tier_items = []
    reservation_items: Dict[str, Tuple[int, float]] = {}
    now = datetime.utcnow()

    for tier_id in sorted(requested_quantities):
        quantity = requested_quantities[tier_id]
        tier = tier_map.get(tier_id)
        if not tier or tier.event_id != event.id:
            raise HTTPException(status_code=400, detail=f"Invalid tier ID: {tier_id}")
            
        if quantity > tier.max_per_order:
            raise HTTPException(status_code=400, detail=f"Cannot order more than {tier.max_per_order} for {tier.name}.")

        ensure_capacity(session, tier, quantity)
            
        if tier.sale_start and now < tier.sale_start:
            raise HTTPException(status_code=400, detail=f"Sales for {tier.name} have not started.")
            
        cutoff_time = tier.sale_end if tier.sale_end is not None else event.date_start
        if cutoff_time and now > cutoff_time:
            raise HTTPException(status_code=400, detail=f"Sales for {tier.name} have ended.")
            
        # Target tier promo validation
        if promo and promo.target_tier_id and promo.target_tier_id != tier.id:
             raise HTTPException(status_code=400, detail="Promo code is not applicable to selected tiers.")

        tier_items.append((tier, quantity))
        reservation_items[tier.id] = (quantity, float(tier.price))

    # 4. Calculate Fees
    fee_breakdown = fee_service.calculate_order_fees(event, tier_items, promo, session)
    order.subtotal_amount = fee_breakdown.subtotal_amount
    order.total_amount = fee_breakdown.gross_amount
    order.platform_fee_amount = fee_breakdown.platform_fee_amount
    order.status = "pending_payment"
    order.updated_at = datetime.utcnow()
    session.add(order)
    create_active_reservations(session, order, reservation_items)

    # 5. Free claims reserve and consume in the same transaction.
    if fee_breakdown.gross_amount <= 0.0:
        consume_order_reservations(session, order)
        order.status = "completed"
        order.updated_at = datetime.utcnow()
        session.add(order)
        if promo:
            promo.usage_count += 1
            session.add(promo)
        session.commit()

        from app.services.stripe_service import trigger_order_confirmation_emails
        trigger_order_confirmation_emails(order, session)
        return {"free_order": True, "order_ref": order.order_ref}

    # 6. Commit the durable reservation before making any Stripe request.
    session.commit()
    response = _create_or_reuse_payment_intent(order, session)
    response["pass_fees_to_buyer"] = fee_breakdown.pass_fees_to_buyer
    return response
