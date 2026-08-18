import pytest
import json
import secrets
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.core.config import settings
from app.models.user import User
from app.models.event import Event
from app.models.ticket_tier import TicketTier
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.organizer_stripe_account import OrganizerStripeAccount

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
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_stripe_connect_webhook_payment_intent_succeeded(client: TestClient, test_db: Session):
    # Setup test event and tier
    event = Event(
        id="evt-connect-1",
        title="Connect Test Event",
        description="Testing Connect Webhooks",
        date_start=datetime.now(timezone.utc) + timedelta(days=10),
        date_end=datetime.now(timezone.utc) + timedelta(days=10, hours=3),
        location_name="Inverness Town Hall",
        is_ticketing_enabled=True
    )
    tier = TicketTier(
        id="tier-conn-1",
        event_id=event.id,
        name="General Admission",
        price=25.0,
        quantity_available=100,
        quantity_sold=0,
        max_per_order=10
    )
    test_db.add(event)
    test_db.add(tier)
    test_db.commit()

    # Mock Stripe Event construction for payment_intent.succeeded
    fake_intent_data = MagicMock()
    fake_intent_data.id = "pi_test_connect_123"
    fake_intent_data.status = "succeeded"
    fake_intent_data.amount = 5000  # £50.00 in pence
    fake_intent_data.application_fee_amount = 250  # £2.50 in pence
    fake_intent_data.metadata = {
        "event_id": "evt-connect-1",
        "buyer_name": "Hamish MacLeod",
        "buyer_email": "hamish@example.com",
        "buyer_phone": "07123456789",
        "platform_fee_amount": "2.50",
        "items_json": json.dumps([{"tier_id": "tier-conn-1", "quantity": 2}]),
        "attendee_responses": json.dumps({"t-shirt": "XL"})
    }
    fake_intent_data.charges = MagicMock(data=[])

    fake_stripe_event = MagicMock()
    fake_stripe_event.type = "payment_intent.succeeded"
    fake_stripe_event.data.object = fake_intent_data

    with patch.object(settings, "STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_test_connect_secret"), \
         patch("stripe.Webhook.construct_event", return_value=fake_stripe_event):
        
        response = client.post(
            "/api/webhooks/stripe-connect",
            content=b'{"id":"evt_123"}',
            headers={"stripe-signature": "t=123,v1=signature"}
        )

        assert response.status_code == 200
        assert response.json() == {"status": "success"}

    # Verify Order and Tickets were fulfilled in database
    order = test_db.exec(select(Order).where(Order.event_id == "evt-connect-1")).first()
    assert order is not None
    assert order.buyer_name == "Hamish MacLeod"
    assert order.buyer_email == "hamish@example.com"
    assert order.total_amount == 50.0
    assert order.platform_fee_amount == 2.50
    assert order.status == "completed"
    assert order.stripe_payment_intent_id == "pi_test_connect_123"

    tickets = test_db.exec(select(Ticket).where(Ticket.order_id == order.id)).all()
    assert len(tickets) == 2
    assert all(t.status == "valid" for t in tickets)

    # Verify Tier quantity_sold incremented
    test_db.refresh(tier)
    assert tier.quantity_sold == 2


def test_standard_stripe_webhook_coexists(client: TestClient):
    fake_stripe_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_standard_456",
                "metadata": {"booking_id": "test_booking"}
            }
        }
    }

    mock_event_obj = MagicMock()
    mock_event_obj.type = "checkout.session.completed"
    mock_event_obj.data.object = fake_stripe_event["data"]["object"]

    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test_standard_secret"), \
         patch("stripe.Webhook.construct_event", return_value=mock_event_obj), \
         patch("app.api.webhooks.handle_checkout_completed") as mock_handle:
        
        response = client.post(
            "/api/webhooks/stripe",
            content=b'{"id":"evt_std_123"}',
            headers={"stripe-signature": "t=123,v1=standardsig"}
        )

        assert response.status_code == 200
        assert response.json() == {"status": "success"}
        mock_handle.assert_called_once()
