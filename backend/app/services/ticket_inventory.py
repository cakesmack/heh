from __future__ import annotations

import secrets
from datetime import datetime
from typing import Dict, Iterable, List, Mapping, Tuple

from fastapi import HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Order, Ticket, TicketReservation, TicketTier


ACTIVE_RESERVATION = "active"
CONSUMED_RESERVATION = "consumed"
RELEASED_RESERVATION = "released"


def lock_ticket_tiers(session: Session, tier_ids: Iterable[str]) -> Dict[str, TicketTier]:
    """Lock tiers in a deterministic order to avoid cross-tier deadlocks."""
    ordered_ids = sorted(set(tier_ids))
    if not ordered_ids:
        return {}
    tiers = session.exec(
        select(TicketTier)
        .where(TicketTier.id.in_(ordered_ids))
        .order_by(TicketTier.id)
        .with_for_update()
    ).all()
    return {tier.id: tier for tier in tiers}


def active_reserved_quantity(session: Session, tier_id: str) -> int:
    value = session.exec(
        select(func.coalesce(func.sum(TicketReservation.quantity), 0)).where(
            TicketReservation.tier_id == tier_id,
            TicketReservation.status == ACTIVE_RESERVATION,
        )
    ).one()
    return int(value or 0)


def committed_quantity(session: Session, tier: TicketTier) -> int:
    return int(tier.quantity_sold or 0) + active_reserved_quantity(session, tier.id)


def ensure_capacity(
    session: Session,
    tier: TicketTier,
    requested_quantity: int = 0,
    *,
    proposed_capacity: int | None = None,
) -> None:
    capacity = tier.quantity_available if proposed_capacity is None else proposed_capacity
    if committed_quantity(session, tier) + requested_quantity > capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough tickets available for {tier.name}.",
        )


def create_active_reservations(
    session: Session,
    order: Order,
    tier_items: Mapping[str, Tuple[int, float]],
) -> List[TicketReservation]:
    reservations: List[TicketReservation] = []
    for tier_id in sorted(tier_items):
        quantity, unit_price = tier_items[tier_id]
        reservation = TicketReservation(
            order_id=order.id,
            tier_id=tier_id,
            quantity=quantity,
            unit_price=unit_price,
            status=ACTIVE_RESERVATION,
        )
        session.add(reservation)
        reservations.append(reservation)
    return reservations


def consume_order_reservations(
    session: Session,
    order: Order,
    *,
    ticket_status: str = "valid",
    checked_in_at: datetime | None = None,
    checked_in_by: str | None = None,
) -> List[Ticket]:
    reservations = session.exec(
        select(TicketReservation)
        .where(TicketReservation.order_id == order.id)
        .order_by(TicketReservation.tier_id)
        .with_for_update()
    ).all()
    if not reservations:
        raise RuntimeError(f"Order {order.id} has no durable reservations")
    if any(reservation.status != ACTIVE_RESERVATION for reservation in reservations):
        raise RuntimeError(f"Order {order.id} reservations are not all active")

    tier_map = lock_ticket_tiers(session, [reservation.tier_id for reservation in reservations])
    if len(tier_map) != len(reservations):
        raise RuntimeError(f"Order {order.id} references a missing ticket tier")

    now = datetime.utcnow()
    tickets: List[Ticket] = []
    for reservation in reservations:
        tier = tier_map[reservation.tier_id]
        # Moving an active reservation to sold leaves total committed stock unchanged.
        tier.quantity_sold += reservation.quantity
        tier.updated_at = now
        reservation.status = CONSUMED_RESERVATION
        reservation.consumed_at = now
        reservation.updated_at = now
        session.add(tier)
        session.add(reservation)
        for _ in range(reservation.quantity):
            ticket = Ticket(
                order_id=order.id,
                tier_id=tier.id,
                qr_token=secrets.token_urlsafe(48),
                status=ticket_status,
                checked_in_at=checked_in_at,
                checked_in_by=checked_in_by,
            )
            session.add(ticket)
            tickets.append(ticket)
    return tickets


def release_order_reservations(session: Session, order: Order) -> bool:
    reservations = session.exec(
        select(TicketReservation)
        .where(TicketReservation.order_id == order.id)
        .order_by(TicketReservation.tier_id)
        .with_for_update()
    ).all()
    active = [item for item in reservations if item.status == ACTIVE_RESERVATION]
    if not active:
        return False

    # Tier locks serialize release against capacity changes and new reservations.
    lock_ticket_tiers(session, [item.tier_id for item in active])
    now = datetime.utcnow()
    for reservation in active:
        reservation.status = RELEASED_RESERVATION
        reservation.released_at = now
        reservation.updated_at = now
        session.add(reservation)
    return True
