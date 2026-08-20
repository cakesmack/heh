from __future__ import annotations
from typing import Any, Dict, List, Optional, Union, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.order import Order
from app.models.ticket_tier import TicketTier
from app.models.ticket import Ticket
from app.core.utils import normalize_uuid
import csv
import io
from fastapi.responses import StreamingResponse

router = APIRouter()

def verify_organizer_access(event_id: str, user: User, session: Session) -> Event:
    event = session.exec(select(Event).where(Event.slug == event_id)).first()
    if not event:
        event = session.get(Event, normalize_uuid(event_id))
    if not event:
        event = session.get(Event, event_id)
        
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    if user.seller_tier < 2:
        raise HTTPException(status_code=403, detail="You do not have active seller permissions.")
        
    # Check if user is the organizer of the event
    is_owner = (
        user.id == event.organizer_id or 
        (event.venue and getattr(event.venue, "owner_id", None) == user.id) or 
        (event.organizer_profile_id and any(p.id == event.organizer_profile_id for p in (getattr(user, "organizer_profiles", []) or [])))
    )
    if not is_owner and not user.is_admin:
        raise HTTPException(status_code=403, detail="You do not have permission to view this event's dashboard.")
        
    return event

@router.get("/events/{event_id}/dashboard")
def get_organizer_dashboard(event_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    event = verify_organizer_access(event_id, current_user, session)
    
    # Calculate financials from completed orders
    orders = session.exec(select(Order).where(Order.event_id == event.id, Order.status == "completed")).all()
    gross_revenue = sum(o.total_amount for o in orders)
    platform_fees = sum(o.platform_fee_amount for o in orders)
    net_payout = gross_revenue - platform_fees
    
    # Get inventory status
    tiers = session.exec(select(TicketTier).where(TicketTier.event_id == event.id)).all()
    inventory = []
    for t in tiers:
        inventory.append({
            "tier_id": t.id,
            "name": t.name,
            "quantity_available": t.quantity_available,
            "quantity_sold": t.quantity_sold,
            "price": t.price
        })
        
    return {
        "event_id": event.id,
        "event_title": event.title,
        "is_cancelled": getattr(event, "is_cancelled", False),
        "cancellation_reason": getattr(event, "cancellation_reason", None),
        "cancelled_at": event.cancelled_at.isoformat() if getattr(event, "cancelled_at", None) else None,
        "gross_revenue": gross_revenue,
        "platform_fees": platform_fees,
        "net_payout": net_payout,
        "total_orders": len(orders),
        "inventory": inventory
    }

@router.get("/events/{event_id}/export-guests")
def export_guest_list(event_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    event = verify_organizer_access(event_id, current_user, session)
    
    # Fetch all tickets that are valid or checked_in
    tickets = session.exec(
        select(Ticket, Order, TicketTier)
        .join(Order, Ticket.order_id == Order.id)
        .join(TicketTier, Ticket.tier_id == TicketTier.id)
        .where(Order.event_id == event.id)
        .where(Ticket.status.in_(["valid", "checked_in"]))
    ).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Attendee Name", "Email", "Ticket Tier", "Order Ref", "Ticket ID", "Status", "Checked In At", "Custom Responses"])
    
    for ticket, order, tier in tickets:
        responses_str = ""
        if order.attendee_responses:
            responses_str = "; ".join([f"{k}: {v}" for k, v in order.attendee_responses.items()])
            
        writer.writerow([
            order.buyer_name,
            order.buyer_email,
            tier.name,
            order.order_ref,
            ticket.id,
            ticket.status,
            ticket.checked_in_at.isoformat() if ticket.checked_in_at else "N/A",
            responses_str
        ])
        
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename=guest_list_{event_id}.csv"}
    )

@router.get("/scanner/events")
def get_organizer_scanner_events(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Returns all ticketed events for the current organizer with scanning activation status and check-in stats.
    """
    if current_user.seller_tier < 2 and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Active seller or organizer access required.")

    # Get events owned by user
    organizer_profile_ids = [p.id for p in (getattr(current_user, "organizer_profiles", []) or [])]
    
    query = select(Event).where(
        Event.is_ticketing_enabled == True
    )
    
    if not current_user.is_admin:
        from sqlmodel import or_
        conditions = [Event.organizer_id == current_user.id]
        if organizer_profile_ids:
            conditions.append(Event.organizer_profile_id.in_(organizer_profile_ids))
        query = query.where(or_(*conditions))

    events = session.exec(query.order_by(Event.date_start.desc())).all()
    
    results = []
    for ev in events:
        # Calculate tickets sold & checked in
        all_tickets = session.exec(
            select(Ticket).join(Order, Ticket.order_id == Order.id).where(Order.event_id == ev.id)
        ).all()
        total_sold = len(all_tickets)
        checked_in = len([t for t in all_tickets if t.status == "checked_in"])
        
        venue_name = ""
        if ev.venue:
            venue_name = ev.venue.name or ""
        elif ev.location_name:
            venue_name = ev.location_name or ""

        is_active = bool(ev.scanner_access_key)
        scanner_url = f"/scan/{ev.id}?token={ev.scanner_access_key}" if is_active else None

        results.append({
            "event_id": ev.id,
            "title": ev.title,
            "date_start": ev.date_start,
            "date_end": ev.date_end,
            "venue_name": venue_name,
            "image_url": ev.image_url,
            "sales_frozen": ev.sales_frozen,
            "is_scanner_active": is_active,
            "scanner_access_key": ev.scanner_access_key,
            "scanner_url": scanner_url,
            "total_tickets_sold": total_sold,
            "total_checked_in": checked_in,
        })

    return {"events": results}

@router.post("/events/{event_id}/activate-scanner")
def activate_event_scanner(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Activates check-in barcode scanning for an event by generating a secure door session key.
    """
    event = verify_organizer_access(event_id, current_user, session)
    
    import secrets
    token = secrets.token_urlsafe(32)
    event.scanner_access_key = token
    session.add(event)
    session.commit()
    session.refresh(event)

    return {
        "status": "active",
        "event_id": event.id,
        "event_title": event.title,
        "scanner_access_key": token,
        "scanner_url": f"/scan/{event.id}?token={token}",
        "message": f"Scanner activated for '{event.title}'"
    }

@router.post("/events/{event_id}/deactivate-scanner")
def deactivate_event_scanner(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Deactivates check-in scanning for an event by revoking the access key.
    """
    event = verify_organizer_access(event_id, current_user, session)
    event.scanner_access_key = None
    session.add(event)
    session.commit()

    return {
        "status": "inactive",
        "event_id": event.id,
        "message": f"Scanner deactivated for '{event.title}'"
    }


def get_uk_tax_year(dt) -> str:
    """Returns UK tax year string e.g. '2025/2026'."""
    if not dt:
        return ""
    year = dt.year
    if dt.month >= 4:
        return f"{year}/{year + 1}"
    return f"{year - 1}/{year}"


@router.get("/invoices")
def get_organizer_invoices(
    event_id: str = None,
    tax_year: str = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Returns full list of customer ticket purchase invoices, platform fee statements,
    and tax breakdown for events managed by the organizer.
    """
    if current_user.seller_tier < 2 and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Active seller or organizer access required.")

    # 1. Fetch organizer's events
    organizer_profile_ids = [p.id for p in (getattr(current_user, "organizer_profiles", []) or [])]
    event_query = select(Event).where(Event.is_ticketing_enabled == True)
    
    if not current_user.is_admin:
        from sqlmodel import or_
        conditions = [Event.organizer_id == current_user.id]
        if organizer_profile_ids:
            conditions.append(Event.organizer_profile_id.in_(organizer_profile_ids))
        event_query = event_query.where(or_(*conditions))

    events = session.exec(event_query).all()
    event_map = {e.id: e for e in events}
    event_ids = list(event_map.keys())

    if not event_ids:
        return {
            "summary": {
                "total_gross": 0.0,
                "total_fees": 0.0,
                "total_net": 0.0,
                "total_invoices": 0,
                "total_tickets": 0
            },
            "invoices": [],
            "events_filter": [],
            "tax_years": []
        }

    # 2. Fetch all completed orders
    order_query = select(Order).where(
        Order.event_id.in_(event_ids),
        Order.status == "completed"
    )
    if event_id:
        order_query = order_query.where(Order.event_id == event_id)

    orders = session.exec(order_query.order_by(Order.created_at.desc())).all()

    invoices = []
    total_gross = 0.0
    total_fees = 0.0
    total_net = 0.0
    total_tickets = 0
    tax_years_set = set()

    for order in orders:
        ev = event_map.get(order.event_id)
        ev_title = ev.title if ev else "Event"
        t_year = get_uk_tax_year(order.created_at)
        tax_years_set.add(t_year)

        if tax_year and t_year != tax_year:
            continue

        tickets_list = session.exec(
            select(Ticket).where(Ticket.order_id == order.id)
        ).all()
        t_count = len(tickets_list)

        gross = float(order.total_amount or 0.0)
        fee = float(order.platform_fee_amount or 0.0)
        net = max(0.0, gross - fee)

        total_gross += gross
        total_fees += fee
        total_net += net
        total_tickets += t_count

        invoices.append({
            "invoice_ref": f"INV-{order.order_ref}",
            "order_id": order.id,
            "order_ref": order.order_ref,
            "event_id": order.event_id,
            "event_title": ev_title,
            "created_at": order.created_at,
            "tax_year": t_year,
            "buyer_name": order.buyer_name,
            "buyer_email": order.buyer_email,
            "tickets_count": t_count,
            "total_gross": round(gross, 2),
            "platform_fee": round(fee, 2),
            "net_payout": round(net, 2),
            "status": order.status,
            "currency": "GBP"
        })

    events_filter = [{"id": e.id, "title": e.title} for e in events]
    tax_years_list = sorted(list(tax_years_set), reverse=True)

    return {
        "summary": {
            "total_gross": round(total_gross, 2),
            "total_fees": round(total_fees, 2),
            "total_net": round(total_net, 2),
            "total_invoices": len(invoices),
            "total_tickets": total_tickets
        },
        "invoices": invoices,
        "events_filter": events_filter,
        "tax_years": tax_years_list
    }


@router.get("/invoices/export")
def export_organizer_invoices_csv(
    event_id: str = None,
    tax_year: str = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Downloads full history of invoices and platform fee statements as a tax-compliant CSV file.
    """
    if current_user.seller_tier < 2 and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Active seller or organizer access required.")

    # 1. Fetch organizer's events
    organizer_profile_ids = [p.id for p in (getattr(current_user, "organizer_profiles", []) or [])]
    event_query = select(Event).where(Event.is_ticketing_enabled == True)
    
    if not current_user.is_admin:
        from sqlmodel import or_
        conditions = [Event.organizer_id == current_user.id]
        if organizer_profile_ids:
            conditions.append(Event.organizer_profile_id.in_(organizer_profile_ids))
        event_query = event_query.where(or_(*conditions))

    events = session.exec(event_query).all()
    event_map = {e.id: e for e in events}
    event_ids = list(event_map.keys())

    order_query = select(Order).where(
        Order.event_id.in_(event_ids),
        Order.status == "completed"
    )
    if event_id:
        order_query = order_query.where(Order.event_id == event_id)

    orders = session.exec(order_query.order_by(Order.created_at.desc())).all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write CSV Header
    writer.writerow([
        "Invoice Reference",
        "Issue Date",
        "Tax Year (UK)",
        "Event Title",
        "Order Reference",
        "Buyer Name",
        "Buyer Email",
        "Tickets Sold",
        "Gross Revenue (£)",
        "Platform Service Fee (£)",
        "Net Payout Deposited (£)",
        "Status"
    ])

    for order in orders:
        ev = event_map.get(order.event_id)
        ev_title = ev.title if ev else "Event"
        t_year = get_uk_tax_year(order.created_at)

        if tax_year and t_year != tax_year:
            continue

        tickets_list = session.exec(
            select(Ticket).where(Ticket.order_id == order.id)
        ).all()
        t_count = len(tickets_list) if tickets_list else 1

        gross = float(order.total_amount or 0.0)
        fee = float(order.platform_fee_amount or 0.0)
        net = max(0.0, gross - fee)
        date_str = order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else ""

        writer.writerow([
            f"INV-{order.order_ref}",
            date_str,
            t_year,
            ev_title,
            order.order_ref,
            order.buyer_name,
            order.buyer_email,
            t_count,
            f"{gross:.2f}",
            f"{fee:.2f}",
            f"{net:.2f}",
            order.status.capitalize()
        ])

    csv_data = output.getvalue()
    output.close()

    filename = f"tax_statement_{tax_year or 'all_years'}_{current_user.username or 'organizer'}.csv".replace("/", "_")
    return StreamingResponse(
        io.BytesIO(csv_data.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/invoices/{order_id}")
def get_single_invoice_detail(
    order_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Returns single tax invoice breakdown for printing or saving as PDF.
    """
    order = session.get(Order, order_id)
    if not order:
        order = session.exec(select(Order).where(Order.order_ref == order_id)).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order / Invoice not found.")

    event = session.get(Event, order.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Associated event not found.")

    # Verify ownership
    organizer_profile_ids = [p.id for p in (getattr(current_user, "organizer_profiles", []) or [])]
    is_owner = (
        current_user.id == event.organizer_id or
        (event.venue and getattr(event.venue, "owner_id", None) == current_user.id) or
        (event.organizer_profile_id and event.organizer_profile_id in organizer_profile_ids) or
        current_user.is_admin
    )
    if not is_owner:
        raise HTTPException(status_code=403, detail="You do not have permission to view this invoice.")

    # Load tickets & tiers
    tickets = session.exec(select(Ticket).where(Ticket.order_id == order.id)).all()
    tier_counts = {}
    for t in tickets:
        tier_counts[t.tier_id] = tier_counts.get(t.tier_id, 0) + 1

    line_items = []
    for tier_id, qty in tier_counts.items():
        tier = session.get(TicketTier, tier_id)
        name = tier.name if tier else "General Admission"
        price = tier.price if tier else (order.total_amount / max(1, len(tickets)))
        line_items.append({
            "name": name,
            "quantity": qty,
            "unit_price": round(price, 2),
            "subtotal": round(price * qty, 2)
        })

    venue_str = ""
    if event.venue:
        venue_str = f"{event.venue.name}, {getattr(event.venue, 'address', '')}".strip(", ")
    elif event.location_name:
        venue_str = f"{event.location_name}, {getattr(event, 'location_town', '') or ''}".strip(", ")

    gross = float(order.total_amount or 0.0)
    fee = float(order.platform_fee_amount or 0.0)
    net = max(0.0, gross - fee)

    return {
        "invoice_ref": f"INV-{order.order_ref}",
        "order_ref": order.order_ref,
        "issue_date": order.created_at,
        "tax_year": get_uk_tax_year(order.created_at),
        "status": order.status,
        "platform": {
            "name": "Highland Events Hub Ltd",
            "address": "Highland Events Hub, Inverness, Highlands, IV1 1AA, Scotland",
            "support_email": "support@highlandeventshub.co.uk",
            "vat_note": "Platform Service Fee receipt. All ticket sales are processed on behalf of the registered event organizer."
        },
        "organizer": {
            "name": event.organizer_profile.name if event.organizer_profile else (current_user.username or "Organizer"),
            "email": current_user.email
        },
        "event": {
            "id": event.id,
            "title": event.title,
            "date_start": event.date_start,
            "venue": venue_str
        },
        "buyer": {
            "name": order.buyer_name,
            "email": order.buyer_email
        },
        "line_items": line_items,
        "financials": {
            "gross_amount": round(gross, 2),
            "platform_fee": round(fee, 2),
            "net_payout": round(net, 2),
            "currency": "GBP"
        }
    }


@router.post("/events/{event_id}/cancel")
@router.post("/events/{event_id}/cancel/")
def cancel_ticketing_event(
    event_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Cancels an event, stops ticket sales, automatically issues face-value refunds for all paid orders,
    cancels free RSVPs, and dispatches email notifications to buyers.
    """
    event = verify_organizer_access(event_id, current_user, session)
    if event.is_cancelled:
        return {
            "success": True,
            "message": "Event is already cancelled",
            "event_id": event.id,
            "is_cancelled": True
        }

    from app.services.stripe_service import process_event_cancellation_and_refunds
    result = process_event_cancellation_and_refunds(str(event.id), reason=reason, session=session)
    return result


