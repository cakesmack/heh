"""Reconcile old pending ticket reservations against authoritative Stripe state.

This command is safe to schedule repeatedly. Age only selects candidates; it never
releases stock unless Stripe reports the PaymentIntent as definitively canceled.

For a lost create response with no saved PaymentIntent ID, an operator must first
identify the single matching intent in the connected Stripe account, then run:

    python -m app.scripts.reconcile_ticket_reservations \
        --order-id ORDER_ID --payment-intent-id pi_...

This recovery path only retrieves and validates an existing intent; it never creates one.
"""

import argparse
import asyncio
import json
import logging
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.core.database import engine
from app.models import Order
from app.services.stripe_service import (
    dispatch_order_confirmation_emails,
    reconcile_payment_intent,
    recover_uncertain_payment_intent,
)


logger = logging.getLogger(__name__)


def reconcile_pending_ticket_orders(minimum_age_minutes: int = 30) -> dict[str, int]:
    cutoff = datetime.utcnow() - timedelta(minutes=minimum_age_minutes)
    outcomes: dict[str, int] = {}
    with Session(engine) as session:
        order_ids = session.exec(
            select(Order.id).where(
                Order.status.in_({"pending_payment", "payment_intent_uncertain"}),
                Order.created_at <= cutoff,
            )
        ).all()

    for order_id in order_ids:
        with Session(engine) as session:
            try:
                order = session.get(Order, order_id)
                if not order or not order.stripe_payment_intent_id or not order.stripe_account_id:
                    outcome = "unresolved"
                    logger.error(
                        "Ticket reservation requires operator recovery: order_id=%s order_ref=%s "
                        "payment_intent_id=%s stripe_account_id=%s",
                        order_id,
                        order.order_ref if order else None,
                        order.stripe_payment_intent_id if order else None,
                        order.stripe_account_id if order else None,
                    )
                else:
                    outcome = reconcile_payment_intent(
                        order.stripe_payment_intent_id,
                        session,
                        stripe_account_id=order.stripe_account_id,
                    )
                    if outcome == "fulfilled":
                        email_sent = asyncio.run(
                            dispatch_order_confirmation_emails(order.id)
                        )
                        if not email_sent:
                            logger.error(
                                "Ticket order fulfilled but confirmation email failed: "
                                "order_id=%s order_ref=%s",
                                order.id,
                                order.order_ref,
                            )
                            outcome = "email_error"
                    if outcome in {"unresolved", "account_mismatch", "missing"}:
                        logger.error(
                            "Ticket reservation reconciliation needs attention: "
                            "order_id=%s order_ref=%s outcome=%s",
                            order.id,
                            order.order_ref,
                            outcome,
                        )
            except Exception:
                session.rollback()
                logger.exception("Ticket reservation reconciliation crashed for order_id=%s", order_id)
                outcome = "error"
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
    return outcomes


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--minimum-age-minutes", type=int, default=30)
    parser.add_argument("--order-id")
    parser.add_argument("--payment-intent-id")
    args = parser.parse_args()

    if bool(args.order_id) != bool(args.payment_intent_id):
        parser.error("--order-id and --payment-intent-id must be supplied together")

    if args.order_id:
        with Session(engine) as recovery_session:
            outcome = recover_uncertain_payment_intent(
                args.order_id,
                args.payment_intent_id,
                recovery_session,
            )
        if outcome == "fulfilled":
            email_sent = asyncio.run(dispatch_order_confirmation_emails(args.order_id))
            if not email_sent:
                outcome = "email_error"
        report = {outcome: 1}
    else:
        report = reconcile_pending_ticket_orders(args.minimum_age_minutes)

    print(json.dumps(report, sort_keys=True))
    attention_required = {
        "unresolved",
        "account_mismatch",
        "missing",
        "error",
        "email_error",
    }
    if any(report.get(key, 0) for key in attention_required):
        raise SystemExit(1)
