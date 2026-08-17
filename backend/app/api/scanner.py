from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select
import secrets
import logging

from app.core.database import get_session
from app.core.utils import normalize_uuid
from app.models import Event, Ticket, Order, TicketTier

router = APIRouter()
logger = logging.getLogger(__name__)

class KeyValidationRequest(BaseModel):
    event_id: str
    token: str

class TicketValidationRequest(BaseModel):
    event_id: str
    token: str
    qr_token: str
    device_id: Optional[str] = "Door Staff"

class ManualCheckInRequest(BaseModel):
    event_id: str
    token: str
    ticket_id: str
    device_id: Optional[str] = "Door Staff"

class CashWalkUpRequest(BaseModel):
    event_id: str
    token: str
    tier_id: str
    quantity: int
    notes: Optional[str] = None
    device_id: Optional[str] = "Door Staff"

def _validate_scanner_key(event_id: str, token: str, session: Session) -> Event:
    event = session.exec(select(Event).where(Event.slug == event_id)).first()
    if not event:
        event = session.get(Event, normalize_uuid(event_id))
    if not event:
        event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    if not event.scanner_access_key or event.scanner_access_key != token:
        raise HTTPException(status_code=403, detail="Invalid scanner access key.")
    return event

@router.post("/validate-key")
def validate_key(request: KeyValidationRequest, session: Session = Depends(get_session)):
    event = _validate_scanner_key(request.event_id, request.token, session)
    
    # Calculate stats
    # For speed, we just count orders/tickets
    # Since checking in modifies Ticket status to checked_in, we can count that.
    total_sold = session.exec(select(Ticket).join(Order).where(Order.event_id == event.id)).all()
    checked_in_count = len([t for t in total_sold if t.status == "checked_in"])
    
    return {
        "valid": True,
        "event_title": event.title,
        "total_sold": len(total_sold),
        "total_checked_in": checked_in_count
    }

@router.post("/validate-ticket")
def validate_ticket(request: TicketValidationRequest, session: Session = Depends(get_session)):
    event = _validate_scanner_key(request.event_id, request.token, session)
    
    clean_token = (request.qr_token or "").strip()
    if not clean_token:
        return {"status": "invalid", "message": "No barcode or ticket code provided"}

    # Try qr_token exact match
    ticket = session.exec(
        select(Ticket).where(Ticket.qr_token == clean_token).with_for_update()
    ).first()

    # Fallback to Ticket ID lookup
    if not ticket:
        ticket = session.exec(
            select(Ticket).where(Ticket.id == clean_token).with_for_update()
        ).first()

    # Fallback to Order Ref lookup (find first un-checked-in ticket in that order for this event)
    if not ticket and clean_token.upper().startswith("HEH-"):
        ticket = session.exec(
            select(Ticket).join(Order, Ticket.order_id == Order.id)
            .where(Order.event_id == event.id, Order.order_ref == clean_token.upper())
            .where(Ticket.status == "valid")
            .with_for_update()
        ).first()

    if not ticket or ticket.order.event_id != event.id:
        return {"status": "invalid", "message": "Ticket not recognized for this event"}
        
    if ticket.status == "checked_in":
        return {
            "status": "already_used",
            "message": "Already checked in",
            "buyer_name": ticket.order.buyer_name,
            "tier_name": ticket.tier.name if ticket.tier else "General Admission",
            "order_ref": ticket.order.order_ref,
            "checked_in_at": ticket.checked_in_at.isoformat() if ticket.checked_in_at else None,
            "checked_in_by": ticket.checked_in_by
        }
        
    if ticket.status == "valid":
        ticket.status = "checked_in"
        ticket.checked_in_at = datetime.utcnow()
        ticket.checked_in_by = request.device_id or "Door Staff"
        session.add(ticket)
        session.commit()
        
        return {
            "status": "valid",
            "ticket_id": ticket.id,
            "buyer_name": ticket.order.buyer_name,
            "tier_name": ticket.tier.name if ticket.tier else "General Admission",
            "order_ref": ticket.order.order_ref,
            "checked_in_at": ticket.checked_in_at.isoformat()
        }
        
    return {"status": "invalid", "message": f"Ticket status is {ticket.status}"}

@router.get("/guest-list")
def get_guest_list(
    event_id: str, 
    token: str, 
    search: Optional[str] = None,
    session: Session = Depends(get_session)
):
    _validate_scanner_key(event_id, token, session)
    
    # We join Ticket, Order, TicketTier
    statement = select(Ticket, Order, TicketTier).join(Order).join(TicketTier).where(Order.event_id == event_id)
    results = session.exec(statement).all()
    
    guests = []
    for ticket, order, tier in results:
        if search:
            s = search.lower()
            if s not in order.buyer_name.lower() and s not in order.order_ref.lower():
                continue
                
        guests.append({
            "ticket_id": ticket.id,
            "buyer_name": order.buyer_name,
            "order_ref": order.order_ref,
            "tier_name": tier.name,
            "status": ticket.status,
            "checked_in_at": ticket.checked_in_at
        })
        
    # Sort checked-in to bottom, then by name
    guests.sort(key=lambda x: (x["status"] == "checked_in", x["buyer_name"]))
    return {"guests": guests}

@router.post("/manual-check-in")
def manual_check_in(request: ManualCheckInRequest, session: Session = Depends(get_session)):
    _validate_scanner_key(request.event_id, request.token, session)
    
    ticket = session.exec(select(Ticket).where(Ticket.id == request.ticket_id).with_for_update()).first()
    if not ticket or ticket.order.event_id != request.event_id:
        raise HTTPException(status_code=404, detail="Ticket not found.")
        
    if ticket.status == "checked_in":
        return {"status": "already_used"}
        
    ticket.status = "checked_in"
    ticket.checked_in_at = datetime.utcnow()
    ticket.checked_in_by = request.device_id
    session.add(ticket)
    session.commit()
    
    return {"status": "valid"}

@router.post("/cash-walk-up")
def cash_walk_up(request: CashWalkUpRequest, session: Session = Depends(get_session)):
    event = _validate_scanner_key(request.event_id, request.token, session)
    
    if request.quantity <= 0:
        raise HTTPException(status_code=400, detail="Invalid quantity")
        
    # Lock the tier to enforce capacity
    tier = session.exec(select(TicketTier).where(TicketTier.id == request.tier_id).with_for_update()).first()
    if not tier or tier.event_id != event.id:
        raise HTTPException(status_code=404, detail="Tier not found.")
        
    if tier.quantity_sold + request.quantity > tier.quantity_available:
        raise HTTPException(status_code=400, detail="Not enough tickets available.")
        
    tier.quantity_sold += request.quantity
    session.add(tier)
    
    def generate_order_ref():
        return "HEH-" + secrets.token_hex(3).upper()
        
    order_ref = generate_order_ref()
    while session.exec(select(Order).where(Order.order_ref == order_ref)).first():
        order_ref = generate_order_ref()
        
    total = tier.price * request.quantity
    
    order = Order(
        order_ref=order_ref,
        event_id=event.id,
        buyer_email="walkup@door",
        buyer_name="Cash Walk-Up",
        total_amount=total,
        platform_fee_amount=0.0,
        status="cash_door_sale",
        attendee_responses={"notes": request.notes} if request.notes else {}
    )
    session.add(order)
    session.flush()
    
    for _ in range(request.quantity):
        ticket = Ticket(
            order_id=order.id,
            tier_id=tier.id,
            qr_token=secrets.token_urlsafe(48),
            status="checked_in", # Instantly checked in
            checked_in_at=datetime.utcnow(),
            checked_in_by=request.device_id
        )
        session.add(ticket)
        
    session.commit()
    
    return {"status": "success", "order_ref": order_ref, "quantity": request.quantity, "tier_name": tier.name}
