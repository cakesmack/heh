"""Reconcile old pending ticket reservations against authoritative Stripe state.

This command is safe to schedule repeatedly. Age only selects candidates; it never
releases stock unless Stripe reports the PaymentIntent as definitively canceled.
"""

from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.core.database import engine
from app.models import Order
from app.services.stripe_service import reconcile_payment_intent


def reconcile_pending_ticket_orders(minimum_age_minutes: int = 30) -> dict[str, int]:
    cutoff = datetime.utcnow() - timedelta(minutes=minimum_age_minutes)
    outcomes: dict[str, int] = {}
    with Session(engine) as session:
        order_ids = session.exec(
            select(Order.id).where(
                Order.status == "pending_payment",
                Order.created_at <= cutoff,
            )
        ).all()

    for order_id in order_ids:
        with Session(engine) as session:
            order = session.get(Order, order_id)
            if not order or not order.stripe_payment_intent_id or not order.stripe_account_id:
                outcome = "unresolved"
            else:
                outcome = reconcile_payment_intent(
                    order.stripe_payment_intent_id,
                    session,
                    stripe_account_id=order.stripe_account_id,
                )
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
    return outcomes


if __name__ == "__main__":
    print(reconcile_pending_ticket_orders())
