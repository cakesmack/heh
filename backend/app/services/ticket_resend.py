"""Email-only recovery for existing fulfilled orders. Never calls fulfilment."""
import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from limits import parse
from sqlmodel import Session, select

from app.core.limiter import limiter
from app.models.ticket import Ticket
from app.models.ticket_tier import TicketTier
from app.services.resend_email import resend_email_service
from app.utils.pii import mask_email

logger = logging.getLogger("uvicorn.error.ticket_resend")
RESEND_LIMIT = parse("1/minute")


def audit_resend(order, actor, outcome):
    logger.info("ticket_resend order_id=%s actor_id=%s role=%s outcome=%s timestamp=%s",
                order.id, actor.id, "admin" if actor.is_admin else "organizer", outcome,
                datetime.now(timezone.utc).isoformat())


async def resend_existing_tickets(order, event, actor, session: Session):
    """Caller must authorize this order's event before invoking this shared service."""
    # The management helper accepts slugs as well as IDs. A colliding slug must
    # never authorize tickets belonging to a different canonical event ID.
    if event.id != order.event_id:
        raise HTTPException(status_code=403, detail="Order does not belong to this event.")
    if order.status != "completed" or event.is_cancelled:
        raise HTTPException(status_code=400, detail="Only completed orders for non-cancelled events can be resent.")
    if not order.buyer_email or "@" not in order.buyer_email:
        raise HTTPException(status_code=400, detail="This order has no deliverable buyer email.")
    tickets = session.exec(select(Ticket).where(Ticket.order_id == order.id)).all()
    if not tickets or any(t.status not in {"valid", "checked_in"} or not t.qr_token for t in tickets):
        raise HTTPException(status_code=400, detail="This order has no complete set of existing valid tickets to resend.")

    # Same expiring storage/strategy as existing API rate limits. The canonical
    # order ID shares this cooldown across both authorised resend endpoints.
    try:
        allowed = limiter.limiter.hit(RESEND_LIMIT, "ticket-resend", order.id)
    except Exception:
        audit_resend(order, actor, "throttle_unavailable")
        raise HTTPException(status_code=503, detail="Ticket resend is temporarily unavailable. Please try later.")
    if not allowed:
        audit_resend(order, actor, "throttled")
        raise HTTPException(status_code=429, detail="Please wait one minute before resending this order again.",
                            headers={"Retry-After": "60"})

    summary = {}
    for ticket in tickets:
        tier = session.get(TicketTier, ticket.tier_id)
        item = summary.setdefault(ticket.tier_id, {
            "name": tier.name if tier else "General Admission", "qty": 0,
            "price": tier.price if tier else 0.0, "qr_tokens": [],
        })
        item["qty"] += 1
        item["qr_tokens"].append(ticket.qr_token)

    try:
        venue_info = event.location_name or ""
        if event.venue:
            venue_info = f"{event.venue.name}, {event.venue.address or ''}".strip(", ")
        sent = await resend_email_service.send_ticket_order_confirmation(
            to_email=order.buyer_email, order_ref=order.order_ref,
            event_title=event.title,
            event_date_str=event.date_start.strftime("%A, %d %B %Y at %H:%M") if event.date_start else "",
            venue_info=venue_info, buyer_name=order.buyer_name,
            total_amount=order.total_amount, ticket_summary=list(summary.values()),
        )
    except Exception:
        sent = False
    audit_resend(order, actor, "success" if sent else "failure")
    if not sent:
        raise HTTPException(status_code=502, detail="Unable to send tickets. Please try again in one minute.")
    return {"status": "success", "message": f"Tickets resent to {mask_email(order.buyer_email)}"}
