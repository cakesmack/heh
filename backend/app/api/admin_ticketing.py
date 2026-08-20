from __future__ import annotations
from typing import Any, Dict, List, Optional, Union, Tuple
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field as PydanticField
from sqlmodel import Session, select, or_
from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.order import Order
from app.models.ticket_tier import TicketTier
from app.models.ticket import Ticket
from app.models.organizer import Organizer
from app.models.platform_settings import PlatformSettings
from sqlalchemy import func
import stripe

router = APIRouter()

def verify_admin(user: User):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

@router.get("/orders/search")
def search_orders(q: str = Query(..., min_length=2), current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    verify_admin(current_user)
    
    # Search by email, name, order_ref, or payment intent id / last4
    statement = select(Order).where(
        or_(
            Order.buyer_email.ilike(f"%{q}%"),
            Order.buyer_name.ilike(f"%{q}%"),
            Order.order_ref.ilike(f"%{q}%"),
            Order.stripe_payment_intent_id.ilike(f"%{q}%")
        )
    ).limit(50)
    
    orders = session.exec(statement).all()
    
    results = []
    for order in orders:
        tickets = session.exec(select(Ticket, TicketTier).join(TicketTier, Ticket.tier_id == TicketTier.id).where(Ticket.order_id == order.id)).all()
        ticket_data = []
        for ticket, tier in tickets:
            ticket_data.append({
                "id": ticket.id,
                "tier_name": tier.name,
                "status": ticket.status,
                "qr_token": ticket.qr_token,
                "checked_in_at": ticket.checked_in_at
            })
            
        results.append({
            "order_id": order.id,
            "order_ref": order.order_ref,
            "event_id": order.event_id,
            "buyer_name": order.buyer_name,
            "buyer_email": order.buyer_email,
            "total_amount": order.total_amount,
            "status": order.status,
            "stripe_payment_intent_id": order.stripe_payment_intent_id,
            "tickets": ticket_data,
            "created_at": order.created_at
        })
        
    return {"results": results}

@router.post("/events/{event_id}/freeze")
def freeze_event_sales(event_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    verify_admin(current_user)
    
    event = session.exec(select(Event).where(Event.id == event_id).with_for_update()).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    event.sales_frozen = not event.sales_frozen
    session.add(event)
    session.commit()
    
    return {"status": "success", "sales_frozen": event.sales_frozen, "message": f"Event sales frozen state is now {event.sales_frozen}"}

@router.post("/orders/{order_id}/force-refund")
def force_refund(order_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    verify_admin(current_user)
    
    # Load order and lock it
    order = session.exec(
        select(Order).where(Order.id == order_id).with_for_update()
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != "completed":
        raise HTTPException(status_code=400, detail="Only completed orders can be refunded")
        
    if order.stripe_payment_intent_id:
        try:
            # Trigger Stripe Refund (Bypassing balance checks as admin)
            stripe.Refund.create(
                payment_intent=order.stripe_payment_intent_id,
                reverse_transfer=True,
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
    
    return {"status": "success", "message": "Force refund processed successfully."}

class UpdateBuyerEmailRequest(BaseModel):
    new_email: EmailStr

@router.put("/orders/{order_id}/update-email")
async def update_buyer_email(
    order_id: str,
    payload: UpdateBuyerEmailRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    verify_admin(current_user)
    
    order = session.exec(select(Order).where(Order.id == order_id).with_for_update()).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    old_email = order.buyer_email
    new_email_clean = payload.new_email.strip().lower()
    order.buyer_email = new_email_clean
    order.updated_at = datetime.utcnow()
    
    # Associate user account if matching user exists
    matching_user = session.exec(select(User).where(func.lower(User.email) == new_email_clean)).first()
    if matching_user:
        order.buyer_user_id = matching_user.id
        
    session.add(order)
    session.commit()
    session.refresh(order)
    
    # Trigger a fresh ticket confirmation email with valid QR tokens
    from app.services.stripe_service import dispatch_order_confirmation_emails
    email_dispatched = await dispatch_order_confirmation_emails(order, session)
    
    return {
        "status": "success",
        "order_id": order.id,
        "order_ref": order.order_ref,
        "old_email": old_email,
        "new_email": order.buyer_email,
        "email_dispatched": email_dispatched,
        "message": f"Buyer email updated to {order.buyer_email} and confirmation email re-dispatched."
    }

@router.get("/events/ticketed")
def get_ticketed_events(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    verify_admin(current_user)
    
    events = session.exec(select(Event).where(Event.is_ticketing_enabled == True)).all()
    
    results = []
    for event in events:
        orders_agg = session.exec(
            select(
                func.sum(Order.total_amount),
                func.sum(Order.platform_fee_amount)
            ).where(Order.event_id == event.id, Order.status == 'completed')
        ).first()
        
        total_gross = orders_agg[0] if orders_agg and orders_agg[0] else 0.0
        total_fees = orders_agg[1] if orders_agg and orders_agg[1] else 0.0
        
        tickets_sold_agg = session.exec(
            select(func.sum(TicketTier.quantity_sold))
            .where(TicketTier.event_id == event.id)
        ).first()
        
        tickets_sold = tickets_sold_agg if tickets_sold_agg else 0
        
        organizer_name = event.organizer_profile.name if event.organizer_profile else 'Unknown'
        
        results.append({
            "event_id": event.id,
            "title": event.title,
            "date_start": event.date_start,
            "sales_frozen": event.sales_frozen,
            "organizer_name": organizer_name,
            "total_gross": total_gross,
            "total_fees": total_fees,
            "tickets_sold": tickets_sold
        })
        
    return results

@router.get("/invoices")
def get_invoices(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    verify_admin(current_user)
    
    statement = select(Order, Event).join(Event, Order.event_id == Event.id).where(
        Order.status == "completed",
        Order.platform_fee_amount > 0
    )
    
    records = session.exec(statement).all()
    
    results = []
    for order, event in records:
        organizer_name = event.organizer_profile.name if event.organizer_profile else 'Unknown'
        
        results.append({
            "order_id": order.id,
            "order_ref": order.order_ref,
            "event_id": event.id,
            "event_title": event.title,
            "organizer_name": organizer_name,
            "total_amount": order.total_amount,
            "platform_fee_amount": order.platform_fee_amount,
            "created_at": order.created_at
        })
        
    return results

class FeeSettingsUpdate(BaseModel):
    base_percentage: float = PydanticField(..., ge=0.0, le=100.0, description="Base percentage cut")
    base_flat_fee: float = PydanticField(..., ge=0.0, description="Flat fee per ticket in GBP")
    hard_cap_amount: float = PydanticField(..., ge=0.0, description="Maximum platform fee cap per event in GBP")

@router.get("/settings")
@router.get("/settings/")
def get_fee_settings(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    verify_admin(current_user)
    
    settings = session.get(PlatformSettings, "global")
    if not settings:
        settings = PlatformSettings(
            id="global",
            base_percentage=3.5,
            base_flat_fee=0.30,
            hard_cap_amount=75.00
        )
        session.add(settings)
        session.commit()
        session.refresh(settings)
        
    return {
        "base_percentage": settings.base_percentage,
        "base_flat_fee": settings.base_flat_fee,
        "hard_cap_amount": settings.hard_cap_amount,
        "updated_at": settings.updated_at
    }

@router.put("/settings")
@router.put("/settings/")
def update_fee_settings(
    payload: FeeSettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    verify_admin(current_user)
    
    settings = session.get(PlatformSettings, "global")
    if not settings:
        settings = PlatformSettings(id="global")
        
    settings.base_percentage = round(payload.base_percentage, 2)
    settings.base_flat_fee = round(payload.base_flat_fee, 2)
    settings.hard_cap_amount = round(payload.hard_cap_amount, 2)
    settings.updated_at = datetime.utcnow()
    
    session.add(settings)
    session.commit()
    session.refresh(settings)
    
    return {
        "base_percentage": settings.base_percentage,
        "base_flat_fee": settings.base_flat_fee,
        "hard_cap_amount": settings.hard_cap_amount,
        "updated_at": settings.updated_at,
        "message": "Global fee settings updated successfully."
    }
