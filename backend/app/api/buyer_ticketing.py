from __future__ import annotations
from typing import Any, Dict, List, Optional, Union, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, or_
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.order import Order
from app.models.ticket_tier import TicketTier
from app.models.ticket import Ticket
from app.models.organizer import Organizer
from app.models.organizer_stripe_account import OrganizerStripeAccount
from app.core.utils import normalize_uuid
import stripe

router = APIRouter()

@router.get("/orders")
@router.get("/orders/")
@router.get("/my-tickets")
@router.get("/my-tickets/")
def get_my_orders(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    user_email_clean = (current_user.email or "").strip().lower()
    
    # Query orders belonging to current user ID or current user's email
    conditions = [Order.buyer_user_id == current_user.id]
    if user_email_clean:
        conditions.append(func.lower(Order.buyer_email) == user_email_clean)
        
    orders = session.exec(
        select(Order).where(or_(*conditions)).order_by(Order.created_at.desc())
    ).all()
    
    # Auto-link buyer_user_id if not linked yet
    needs_commit = False
    for o in orders:
        if not o.buyer_user_id:
            o.buyer_user_id = current_user.id
            session.add(o)
            needs_commit = True
    if needs_commit:
        session.commit()
    
    results = []
    for order in orders:
        event = session.get(Event, order.event_id)
        if not event:
            continue
            
        venue_name = ""
        venue_town = ""
        venue_address = ""
        if event.venue:
            venue_name = event.venue.name or ""
            venue_address = getattr(event.venue, "formatted_address", None) or event.venue.address or ""
            venue_town = getattr(event, "location_town", "") or ""
        else:
            venue_name = event.location_name or ""
            venue_town = getattr(event, "location_town", "") or ""
            venue_address = event.location_address or ""
            
        tickets = session.exec(select(Ticket, TicketTier).join(TicketTier, Ticket.tier_id == TicketTier.id).where(Ticket.order_id == order.id)).all()
        ticket_data = []
        for ticket, tier in tickets:
            ticket_data.append({
                "id": ticket.id,
                "tier_name": tier.name,
                "price": tier.price,
                "status": ticket.status
            })
            
        results.append({
            "order_id": order.id,
            "order_ref": order.order_ref,
            "event_title": event.title,
            "event_start": event.date_start,
            "event_end": event.date_end,
            "venue_name": venue_name,
            "venue_town": venue_town,
            "venue_address": venue_address,
            "refund_cutoff_hours": event.refund_cutoff_hours or 48,
            "total_amount": order.total_amount,
            "status": order.status,
            "created_at": order.created_at,
            "tickets": ticket_data
        })
        
    return {"orders": results}

@router.post("/orders/{order_id}/refund")
@router.post("/orders/{order_id}/refund/")
def process_buyer_refund(order_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Load order and lock it
    order = session.exec(
        select(Order).where(Order.id == order_id).with_for_update()
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    user_email_clean = (current_user.email or "").strip().lower()
    is_owner = (order.buyer_user_id == current_user.id) or (order.buyer_email and order.buyer_email.strip().lower() == user_email_clean)
    if not is_owner:
        raise HTTPException(status_code=403, detail="You do not own this order")
        
    if order.status != "completed":
        raise HTTPException(status_code=400, detail="Only completed orders can be refunded")
        
    event = session.get(Event, order.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # Check refund cutoff
    now = datetime.now(timezone.utc)
    # Ensure event.date_start is timezone-aware
    event_start = event.date_start.replace(tzinfo=timezone.utc) if event.date_start.tzinfo is None else event.date_start
    cutoff_time = event_start - timedelta(hours=event.refund_cutoff_hours)
    
    if now > cutoff_time:
        raise HTTPException(status_code=400, detail=f"Refunds must be requested at least {event.refund_cutoff_hours} hours before the event starts.")
        
    # Check Stripe Balance
    stripe_account = None
    if event.organizer_profile_id:
        stripe_account = session.exec(
            select(OrganizerStripeAccount).where(OrganizerStripeAccount.organizer_profile_id == event.organizer_profile_id)
        ).first()
    elif event.organizer_id:
        stmt = (
            select(OrganizerStripeAccount)
            .join(Organizer, OrganizerStripeAccount.organizer_profile_id == Organizer.id)
            .where(Organizer.user_id == event.organizer_id)
        )
        stripe_account = session.exec(stmt).first()
        
    if not stripe_account:
        raise HTTPException(status_code=400, detail="Organizer Stripe account not found.")
        
    if not order.stripe_payment_intent_id:
        raise HTTPException(status_code=400, detail="Cannot refund this order natively.")
        
    try:
        balance = stripe.Balance.retrieve(stripe_account=stripe_account.stripe_account_id)
        available_gbp = next((b for b in balance.available if b.currency == "gbp"), None)
        
        # Stripe amounts are in pence
        refund_amount_pence = int(order.total_amount * 100)
        
        if not available_gbp or available_gbp.amount < refund_amount_pence:
            raise HTTPException(status_code=400, detail="Organizer currently has insufficient funds to process this refund. Please contact them directly.")
            
        # Trigger Stripe Refund
        stripe.Refund.create(
            payment_intent=order.stripe_payment_intent_id,
            reverse_transfer=True,
            # Refunds application fee as well:
            refund_application_fee=True
        )
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe refund failed: {str(e)}")
        
    # Atomically update statuses and inventory
    order.status = "refunded"
    
    # Process tickets
    tickets = session.exec(select(Ticket).where(Ticket.order_id == order.id)).all()
    tier_refund_counts = {}
    
    for t in tickets:
        t.status = "refunded"
        tier_refund_counts[t.tier_id] = tier_refund_counts.get(t.tier_id, 0) + 1
        session.add(t)
        
    # Decrement Ticket Tier quantity_sold
    for tier_id, count in tier_refund_counts.items():
        tier = session.exec(
            select(TicketTier).where(TicketTier.id == tier_id).with_for_update()
        ).first()
        if tier:
            tier.quantity_sold = max(0, tier.quantity_sold - count)
            session.add(tier)
            
    session.add(order)
    session.commit()
    
    return {"status": "success", "message": "Refund processed successfully."}
