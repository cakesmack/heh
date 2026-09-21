from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
import stripe
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

from app.api.auth import get_current_user
from app.core.config import settings
from app.core.database import get_session
from app.main import app
from app.models import (
    Event,
    Order,
    Organizer,
    OrganizerStripeAccount,
    Ticket,
    TicketReservation,
    TicketTier,
    User,
)
from app.services.stripe_service import (
    fulfill_payment_intent,
    reconcile_payment_intent,
    recover_uncertain_payment_intent,
)


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture(name="test_db")
def test_db_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(test_db: Session):
    app.dependency_overrides[get_session] = lambda: test_db
    client = TestClient(app)
    try:
        yield client
    finally:
        client.close()
        app.dependency_overrides.clear()


@pytest.fixture(name="ticketing_setup")
def ticketing_setup_fixture(test_db: Session, monkeypatch):
    monkeypatch.setattr(settings, "NATIVE_TICKET_SALES_ENABLED", True)
    user = User(
        id="reservation_user",
        email="reservation-organizer@example.com",
        username="reservation_organizer",
        seller_tier=2,
        seller_status="approved",
    )
    organizer = Organizer(
        id="reservation_organizer",
        user_id=user.id,
        name="Reservation Organizer",
        slug="reservation-organizer",
    )
    account = OrganizerStripeAccount(
        id="reservation_account",
        organizer_profile_id=organizer.id,
        stripe_account_id="acct_reservation",
        charges_enabled=True,
        payouts_enabled=True,
    )
    event = Event(
        id="reservation_event",
        title="Reservation Event",
        slug="reservation-event",
        date_start=datetime.utcnow() + timedelta(days=10),
        date_end=datetime.utcnow() + timedelta(days=10, hours=2),
        organizer_id=user.id,
        organizer_profile_id=organizer.id,
        is_ticketing_enabled=True,
        scanner_access_key="scanner-secret",
    )
    paid = TicketTier(
        id="paid_tier",
        event_id=event.id,
        name="Paid Admission",
        price=20.0,
        quantity_available=1,
        quantity_sold=0,
        max_per_order=4,
    )
    free = TicketTier(
        id="free_tier",
        event_id=event.id,
        name="Free Admission",
        price=0.0,
        quantity_available=1,
        quantity_sold=0,
        max_per_order=4,
    )
    test_db.add(user)
    test_db.add(organizer)
    test_db.add(account)
    test_db.add(event)
    test_db.add(paid)
    test_db.add(free)
    test_db.commit()
    return SimpleNamespace(user=user, event=event, paid=paid, free=free, account=account)


def checkout_payload(attempt_id: str, tier_id: str) -> dict:
    return {
        "checkout_attempt_id": attempt_id,
        "event_id": "reservation_event",
        "items": [{"tier_id": tier_id, "quantity": 1}],
        "buyer_name": "Reservation Buyer",
        "buyer_email": "reservation-buyer@example.com",
    }


def stripe_intent(order: Order, *, status: str = "succeeded") -> SimpleNamespace:
    return SimpleNamespace(
        id="pi_reserved_order",
        status=status,
        amount=int(round(order.total_amount * 100)),
        currency="gbp",
        metadata={"ticket_order_id": order.id, "order_ref": order.order_ref},
        client_secret="pi_reserved_order_secret",
    )


def test_paid_checkout_commits_order_and_reservation_before_stripe(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    def assert_durable_before_stripe(**kwargs):
        order = test_db.exec(select(Order)).one()
        reservation = test_db.exec(select(TicketReservation)).one()
        assert order.status == "pending_payment"
        assert order.total_amount > 0
        assert reservation.order_id == order.id
        assert reservation.status == "active"
        assert kwargs["idempotency_key"] == f"ticket-order:{order.id}"
        assert "items_json" not in kwargs["metadata"]
        return stripe_intent(order)

    with patch("stripe.PaymentIntent.create", side_effect=assert_durable_before_stripe):
        response = client.post(
            "/api/ticketing/checkout/create-payment-intent",
            json=checkout_payload("paid-reservation-attempt", ticketing_setup.paid.id),
        )

    assert response.status_code == 200, response.text
    order = test_db.exec(select(Order)).one()
    assert order.stripe_payment_intent_id == "pi_reserved_order"
    assert test_db.exec(select(Ticket)).all() == []
    test_db.refresh(ticketing_setup.paid)
    assert ticketing_setup.paid.quantity_sold == 0


def test_stripe_failure_is_persistently_fail_closed_across_retries(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    payload = checkout_payload("retry-reservation-attempt", ticketing_setup.paid.id)
    with patch(
        "stripe.PaymentIntent.create",
        side_effect=stripe.error.APIConnectionError("timeout"),
    ) as create_intent:
        first = client.post("/api/ticketing/checkout/create-payment-intent", json=payload)
    assert first.status_code == 503
    order = test_db.exec(select(Order)).one()
    reservation = test_db.exec(select(TicketReservation)).one()
    assert order.status == "payment_intent_uncertain"
    assert reservation.status == "active"

    with patch("stripe.PaymentIntent.create") as retry_create:
        retry = client.post("/api/ticketing/checkout/create-payment-intent", json=payload)
    assert retry.status_code == 409, retry.text
    assert order.order_ref in retry.json()["detail"]
    assert len(test_db.exec(select(Order)).all()) == 1
    assert len(test_db.exec(select(TicketReservation)).all()) == 1
    assert create_intent.call_count == 1
    retry_create.assert_not_called()

    new_attempt_payload = checkout_payload("retry-after-idempotency-window", ticketing_setup.paid.id)
    with patch("stripe.PaymentIntent.create") as new_attempt_create:
        later_retry = client.post(
            "/api/ticketing/checkout/create-payment-intent",
            json=new_attempt_payload,
        )
    assert later_retry.status_code == 409, later_retry.text
    assert order.order_ref in later_retry.json()["detail"]
    new_attempt_create.assert_not_called()
    assert len(test_db.exec(select(Order)).all()) == 1

    # A late success webhook remains authoritative even though local creation
    # failed closed before the PaymentIntent ID could be persisted.
    result = fulfill_payment_intent(
        stripe_intent(order),
        test_db,
        stripe_account_id="acct_reservation",
    )
    assert result and result.newly_fulfilled is True
    test_db.refresh(order)
    assert order.status == "completed"
    assert order.stripe_payment_intent_id == "pi_reserved_order"


def test_operator_recovery_attaches_existing_intent_without_creating_one(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    payload = checkout_payload("operator-recovery-attempt", ticketing_setup.paid.id)
    with patch(
        "stripe.PaymentIntent.create",
        side_effect=stripe.error.APIConnectionError("timeout"),
    ):
        response = client.post("/api/ticketing/checkout/create-payment-intent", json=payload)
    assert response.status_code == 503
    order = test_db.exec(select(Order)).one()
    intent = stripe_intent(order, status="processing")

    with patch(
        "app.services.stripe_service._retrieve_payment_intent",
        return_value=intent,
    ) as retrieve, patch("stripe.PaymentIntent.create") as create_intent:
        outcome = recover_uncertain_payment_intent(order.id, intent.id, test_db)

    assert outcome == "retained"
    retrieve.assert_called_once_with(intent.id, "acct_reservation")
    create_intent.assert_not_called()
    test_db.refresh(order)
    assert order.status == "payment_intent_uncertain"
    assert order.stripe_payment_intent_id == intent.id
    assert test_db.exec(select(TicketReservation)).one().status == "active"


def test_reconciliation_reports_uncertain_order_without_intent(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
    monkeypatch,
    caplog,
):
    payload = checkout_payload("unresolved-report-attempt", ticketing_setup.paid.id)
    with patch(
        "stripe.PaymentIntent.create",
        side_effect=stripe.error.APIConnectionError("timeout"),
    ):
        response = client.post("/api/ticketing/checkout/create-payment-intent", json=payload)
    assert response.status_code == 503
    order = test_db.exec(select(Order)).one()
    order.created_at = datetime.utcnow() - timedelta(hours=1)
    test_db.add(order)
    test_db.commit()

    from app.scripts import reconcile_ticket_reservations as reconciliation_script

    monkeypatch.setattr(reconciliation_script, "engine", test_db.get_bind())
    outcomes = reconciliation_script.reconcile_pending_ticket_orders(minimum_age_minutes=30)

    assert outcomes == {"unresolved": 1}
    assert order.id in caplog.text


def test_reconciliation_fulfills_and_emails_only_once(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
    monkeypatch,
):
    with patch("stripe.PaymentIntent.create") as create_intent:
        create_intent.side_effect = lambda **kwargs: stripe_intent(
            test_db.exec(select(Order)).one()
        )
        response = client.post(
            "/api/ticketing/checkout/create-payment-intent",
            json=checkout_payload("scheduled-reconciliation-attempt", ticketing_setup.paid.id),
        )
    assert response.status_code == 200
    order = test_db.exec(select(Order)).one()
    order.created_at = datetime.utcnow() - timedelta(hours=1)
    test_db.add(order)
    test_db.commit()
    intent = stripe_intent(order)

    from app.scripts import reconcile_ticket_reservations as reconciliation_script

    monkeypatch.setattr(reconciliation_script, "engine", test_db.get_bind())
    with patch(
        "app.services.stripe_service._retrieve_payment_intent",
        return_value=intent,
    ), patch(
        "app.scripts.reconcile_ticket_reservations.dispatch_order_confirmation_emails",
        new_callable=AsyncMock,
        return_value=True,
    ) as dispatch:
        first = reconciliation_script.reconcile_pending_ticket_orders(30)
        second = reconciliation_script.reconcile_pending_ticket_orders(30)

    assert first == {"fulfilled": 1}
    assert second == {}
    assert dispatch.await_count == 1
    test_db.refresh(order)
    assert order.status == "completed"
    assert len(test_db.exec(select(Ticket)).all()) == 1


def test_reservation_capacity_failure_makes_no_stripe_call(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    pending = Order(
        order_ref="HEH-FULL01",
        event_id=ticketing_setup.event.id,
        buyer_email="pending@example.com",
        buyer_name="Pending Buyer",
        total_amount=20.0,
        subtotal_amount=20.0,
        status="pending_payment",
        stripe_account_id="acct_reservation",
    )
    test_db.add(pending)
    test_db.flush()
    test_db.add(TicketReservation(
        order_id=pending.id,
        tier_id=ticketing_setup.paid.id,
        quantity=1,
        unit_price=20.0,
        status="active",
    ))
    test_db.commit()

    with patch("stripe.PaymentIntent.create") as create_intent:
        response = client.post(
            "/api/ticketing/checkout/create-payment-intent",
            json=checkout_payload("sold-out-paid-attempt", ticketing_setup.paid.id),
        )
    assert response.status_code == 400
    create_intent.assert_not_called()
    test_db.rollback()
    assert len(test_db.exec(select(Order)).all()) == 1


def test_success_consumes_once_and_webhook_before_intent_persistence_is_supported(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    with patch("stripe.PaymentIntent.create") as create_intent:
        create_intent.side_effect = lambda **kwargs: stripe_intent(test_db.exec(select(Order)).one())
        response = client.post(
            "/api/ticketing/checkout/create-payment-intent",
            json=checkout_payload("fulfillment-attempt", ticketing_setup.paid.id),
        )
    assert response.status_code == 200
    order = test_db.exec(select(Order)).one()
    order.stripe_payment_intent_id = None
    test_db.add(order)
    test_db.commit()

    intent = stripe_intent(order)
    first = fulfill_payment_intent(intent, test_db, stripe_account_id="acct_reservation")
    second = fulfill_payment_intent(intent, test_db, stripe_account_id="acct_reservation")
    assert first and first.newly_fulfilled is True
    assert second and second.newly_fulfilled is False
    assert len(test_db.exec(select(Order)).all()) == 1
    assert len(test_db.exec(select(Ticket)).all()) == 1
    reservation = test_db.exec(select(TicketReservation)).one()
    assert reservation.status == "consumed"
    test_db.refresh(ticketing_setup.paid)
    assert ticketing_setup.paid.quantity_sold == 1
    test_db.refresh(order)
    assert order.stripe_payment_intent_id == intent.id


def test_processing_retains_and_canceled_payment_releases_once(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    with patch("stripe.PaymentIntent.create") as create_intent:
        create_intent.side_effect = lambda **kwargs: stripe_intent(test_db.exec(select(Order)).one())
        response = client.post(
            "/api/ticketing/checkout/create-payment-intent",
            json=checkout_payload("reconcile-attempt", ticketing_setup.paid.id),
        )
    assert response.status_code == 200
    order = test_db.exec(select(Order)).one()

    assert reconcile_payment_intent(
        stripe_intent(order, status="processing"),
        test_db,
        stripe_account_id="acct_reservation",
    ) == "retained"
    assert test_db.exec(select(TicketReservation)).one().status == "active"

    canceled = stripe_intent(order, status="canceled")
    assert reconcile_payment_intent(canceled, test_db, stripe_account_id="acct_reservation") == "released"
    assert reconcile_payment_intent(canceled, test_db, stripe_account_id="acct_reservation") == "failed"
    assert test_db.exec(select(TicketReservation)).one().status == "released"
    test_db.refresh(order)
    assert order.status == "failed"


def test_duplicate_success_webhook_dispatches_confirmation_once(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    order = Order(
        order_ref="HEH-WEB001",
        event_id=ticketing_setup.event.id,
        buyer_email="webhook@example.com",
        buyer_name="Webhook Buyer",
        total_amount=20.0,
        subtotal_amount=20.0,
        platform_fee_amount=1.0,
        status="pending_payment",
        stripe_account_id="acct_reservation",
        checkout_attempt_id="webhook-attempt-id",
        checkout_payload_hash="a" * 64,
    )
    test_db.add(order)
    test_db.flush()
    test_db.add(TicketReservation(
        order_id=order.id,
        tier_id=ticketing_setup.paid.id,
        quantity=1,
        unit_price=20.0,
        status="active",
    ))
    test_db.commit()
    intent = stripe_intent(order)
    event = SimpleNamespace(
        type="payment_intent.succeeded",
        account="acct_reservation",
        data=SimpleNamespace(object=intent),
    )

    with patch.object(settings, "STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_test"), \
         patch("stripe.Webhook.construct_event", return_value=event), \
         patch(
             "app.services.stripe_service.dispatch_order_confirmation_emails",
             new_callable=AsyncMock,
             return_value=True,
         ) as dispatch:
        first = client.post(
            "/api/webhooks/stripe-connect",
            content=b"{}",
            headers={"stripe-signature": "test"},
        )
        second = client.post(
            "/api/webhooks/stripe-connect",
            content=b"{}",
            headers={"stripe-signature": "test"},
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert dispatch.await_count == 1
    assert len(test_db.exec(select(Ticket)).all()) == 1
    test_db.refresh(ticketing_setup.paid)
    assert ticketing_setup.paid.quantity_sold == 1


def test_free_and_cash_paths_cannot_bypass_active_paid_reservation(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    # Use the free tier for a synthetic paid pending order so both alternative
    # issuance paths compete with an active reservation for the last place.
    pending = Order(
        order_ref="HEH-PEND01",
        event_id=ticketing_setup.event.id,
        buyer_email="pending@example.com",
        buyer_name="Pending Buyer",
        total_amount=1.0,
        subtotal_amount=1.0,
        status="pending_payment",
        stripe_account_id="acct_reservation",
    )
    test_db.add(pending)
    test_db.flush()
    test_db.add(TicketReservation(
        order_id=pending.id,
        tier_id=ticketing_setup.free.id,
        quantity=1,
        unit_price=0.0,
        status="active",
    ))
    test_db.commit()

    free_response = client.post(
        "/api/ticketing/checkout/create-payment-intent",
        json=checkout_payload("blocked-free-attempt", ticketing_setup.free.id),
    )
    assert free_response.status_code == 400
    test_db.rollback()

    cash_response = client.post(
        "/api/ticketing/scan/cash-walk-up",
        json={
            "event_id": ticketing_setup.event.id,
            "token": "scanner-secret",
            "tier_id": ticketing_setup.free.id,
            "quantity": 1,
        },
    )
    assert cash_response.status_code == 400
    test_db.rollback()
    assert len(test_db.exec(select(Order)).all()) == 1
    assert len(test_db.exec(select(Ticket)).all()) == 0


def test_capacity_cannot_be_reduced_below_active_commitments(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    pending = Order(
        order_ref="HEH-CAP001",
        event_id=ticketing_setup.event.id,
        buyer_email="pending@example.com",
        buyer_name="Pending Buyer",
        total_amount=20.0,
        subtotal_amount=20.0,
        status="pending_payment",
        stripe_account_id="acct_reservation",
    )
    test_db.add(pending)
    test_db.flush()
    test_db.add(TicketReservation(
        order_id=pending.id,
        tier_id=ticketing_setup.paid.id,
        quantity=1,
        unit_price=20.0,
        status="active",
    ))
    test_db.commit()
    app.dependency_overrides[get_current_user] = lambda: ticketing_setup.user

    response = client.put(
        f"/api/events/{ticketing_setup.event.id}/tiers/{ticketing_setup.paid.id}",
        json={"quantity_available": 0},
    )
    assert response.status_code == 400, response.text
    test_db.refresh(ticketing_setup.paid)
    assert ticketing_setup.paid.quantity_available == 1


def test_direct_charge_refund_uses_connected_account_context(
    client: TestClient,
    test_db: Session,
    ticketing_setup,
):
    buyer = User(
        id="refund_buyer",
        email="refund-buyer@example.com",
        username="refund_buyer",
    )
    order = Order(
        id="refund_order",
        order_ref="HEH-REF001",
        event_id=ticketing_setup.event.id,
        buyer_user_id=buyer.id,
        buyer_email=buyer.email,
        buyer_name="Refund Buyer",
        total_amount=20.0,
        subtotal_amount=20.0,
        platform_fee_amount=1.0,
        stripe_payment_intent_id="pi_refund_direct",
        stripe_account_id="acct_reservation",
        status="completed",
    )
    ticket = Ticket(
        id="refund_ticket",
        order_id=order.id,
        tier_id=ticketing_setup.paid.id,
        qr_token="refund_qr",
        status="valid",
    )
    ticketing_setup.paid.quantity_sold = 1
    test_db.add(buyer)
    test_db.add(order)
    test_db.add(ticket)
    test_db.add(ticketing_setup.paid)
    test_db.commit()
    app.dependency_overrides[get_current_user] = lambda: buyer

    balance = SimpleNamespace(available=[SimpleNamespace(currency="gbp", amount=10_000)])
    with patch("stripe.Balance.retrieve", return_value=balance), \
         patch("stripe.Refund.create") as create_refund:
        response = client.post(f"/api/ticketing/buyer/orders/{order.id}/refund")

    assert response.status_code == 200, response.text
    create_refund.assert_called_once_with(
        payment_intent="pi_refund_direct",
        stripe_account="acct_reservation",
        refund_application_fee=True,
    )
    test_db.refresh(ticketing_setup.paid)
    assert ticketing_setup.paid.quantity_sold == 0
