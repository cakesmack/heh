import pytest
from datetime import datetime, timedelta
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import JSONB
import sqlmodel as sm
from unittest.mock import patch, MagicMock

from app.main import app
from app.core.database import get_session
from app.models.user import User
from app.models.event import Event
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.ticket_tier import TicketTier
from app.models.promotion import Promotion
from app.models.featured_booking import FeaturedBooking
from app.models.organizer import Organizer
from app.models.organizer_stripe_account import OrganizerStripeAccount
from app.services.stripe_service import process_event_cancellation_and_refunds
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

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
    def get_session_override():
        return test_db
    app.dependency_overrides[get_session] = get_session_override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_session, None)


def test_event_cancellation_service_and_refunds(client: TestClient, test_db: Session):
    organizer = User(
        id="org_user_cancel_1",
        email="org@highland.com",
        username="org_cancel_1",
        seller_tier=2
    )
    test_db.add(organizer)

    event = Event(
        id="evt_cancel_101",
        title="Inverness Music Fest",
        date_start=datetime.utcnow() + timedelta(days=5),
        date_end=datetime.utcnow() + timedelta(days=5, hours=4),
        organizer_id=organizer.id,
        is_ticketing_enabled=True,
        status="published",
        is_cancelled=False,
        sales_frozen=False
    )
    test_db.add(event)

    tier = TicketTier(
        id="tier_cancel_1",
        event_id=event.id,
        name="Standard Entry",
        price=20.0,
        quantity_available=100,
        quantity_sold=2
    )
    test_db.add(tier)

    # 1. Paid Order
    paid_order = Order(
        id="order_paid_1",
        order_ref="HEH-PAID1",
        event_id=event.id,
        buyer_name="John Smith",
        buyer_email="john@example.com",
        total_amount=22.0,  # 20 face + 2 fee
        platform_fee_amount=2.0,
        stripe_payment_intent_id="pi_test_12345",
        status="completed"
    )
    test_db.add(paid_order)

    ticket_paid = Ticket(
        id="tkt_paid_1",
        order_id=paid_order.id,
        tier_id=tier.id,
        qr_token="TOKEN-PAID-1",
        status="valid"
    )
    test_db.add(ticket_paid)

    # 2. Free Order
    free_order = Order(
        id="order_free_1",
        order_ref="HEH-FREE1",
        event_id=event.id,
        buyer_name="Jane Doe",
        buyer_email="jane@example.com",
        total_amount=0.0,
        platform_fee_amount=0.0,
        status="completed"
    )
    test_db.add(free_order)

    ticket_free = Ticket(
        id="tkt_free_1",
        order_id=free_order.id,
        tier_id=tier.id,
        qr_token="TOKEN-FREE-1",
        status="valid"
    )
    test_db.add(ticket_free)
    test_db.commit()

    with patch("stripe.Refund.create") as mock_refund, \
         patch("app.services.resend_email.resend_email_service.send_event_cancellation_refund_notification") as mock_email:
        
        result = process_event_cancellation_and_refunds(
            event_id=event.id,
            reason="Performer illness",
            session=test_db
        )

        assert result["success"] is True
        assert result["is_cancelled"] is True
        assert result["refunded_orders"] == 1
        assert result["cancelled_orders"] == 1

        # Check Stripe Refund call
        mock_refund.assert_called_once()
        refund_call_kwargs = mock_refund.call_args.kwargs
        assert refund_call_kwargs["payment_intent"] == "pi_test_12345"
        assert refund_call_kwargs["amount"] == 2000  # 20.00 GBP in pence (face value)

    # Verify Database state
    test_db.refresh(event)
    assert event.is_cancelled is True
    assert event.sales_frozen is True
    assert event.cancellation_reason == "Performer illness"
    assert event.cancelled_at is not None

    test_db.refresh(paid_order)
    assert paid_order.status == "refunded"

    test_db.refresh(ticket_paid)
    assert ticket_paid.status == "refunded"

    test_db.refresh(free_order)
    assert free_order.status == "cancelled"

    test_db.refresh(ticket_free)
    assert ticket_free.status == "cancelled"


def test_scanner_lockdown_on_cancelled_event(client: TestClient, test_db: Session):
    organizer = User(
        id="org_user_scan_lock",
        email="org@scan.com",
        username="org_scan",
        seller_tier=2
    )
    test_db.add(organizer)

    event = Event(
        id="evt_scan_lock_1",
        title="Cancelled Ceilidh",
        date_start=datetime.utcnow() + timedelta(days=1),
        date_end=datetime.utcnow() + timedelta(days=1, hours=3),
        organizer_id=organizer.id,
        is_ticketing_enabled=True,
        scanner_access_key="scanner_token_123",
        is_cancelled=True,
        cancellation_reason="Severe storm warning"
    )
    test_db.add(event)

    order = Order(
        id="order_lock_1",
        order_ref="HEH-LOCK1",
        event_id=event.id,
        buyer_name="Alice Walker",
        buyer_email="alice@example.com",
        total_amount=15.0,
        status="refunded"
    )
    test_db.add(order)

    tier = TicketTier(
        id="tier_scan_lock",
        event_id=event.id,
        name="General Entry",
        price=15.0,
        quantity_available=50,
        quantity_sold=1
    )
    test_db.add(tier)

    ticket = Ticket(
        id="tkt_lock_1",
        order_id=order.id,
        tier_id=tier.id,
        qr_token="TOKEN-LOCK-1",
        status="refunded"
    )
    test_db.add(ticket)
    test_db.commit()

    # Validate Key Check
    res_key = client.post("/api/ticketing/scan/validate-key", json={
        "event_id": event.id,
        "token": "scanner_token_123"
    })
    assert res_key.status_code == 200
    assert res_key.json()["is_cancelled"] is True

    # Validate Ticket Check
    res_ticket = client.post("/api/ticketing/scan/validate-ticket", json={
        "event_id": event.id,
        "token": "scanner_token_123",
        "qr_token": "TOKEN-LOCK-1"
    })
    assert res_ticket.status_code == 200
    data = res_ticket.json()
    assert data["status"] == "invalid"
    assert data.get("is_cancelled") is True or data["error"] == "EVENT_CANCELLED"
