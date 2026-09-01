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
         patch("stripe.Webhook.construct_event", return_value=fake_stripe_event), \
         patch("app.services.resend_email.resend_email_service.send_ticket_order_confirmation") as mock_send_email:
        
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

    # Verify email dispatch was triggered for the buyer
    mock_send_email.assert_called_once()
    call_kwargs = mock_send_email.call_args.kwargs
    assert call_kwargs["to_email"] == "hamish@example.com"
    assert call_kwargs["order_ref"] == order.order_ref
    assert call_kwargs["event_title"] == "Connect Test Event"


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


def test_stripe_connect_webhook_organizer_notifications_and_email(client: TestClient, test_db: Session):
    from app.models.notification import Notification

    # Create Organizer User
    organizer_user = User(
        id="usr_org_456",
        email="organizer@highlandevents.co.uk",
        username="cairngorm_events",
        seller_status="approved",
        seller_tier=2
    )
    test_db.add(organizer_user)

    # Setup test event linked to organizer
    event = Event(
        id="evt-connect-org-1",
        title="Cairngorm Ceilidh Night",
        description="A great highland evening",
        date_start=datetime.now(timezone.utc) + timedelta(days=5),
        date_end=datetime.now(timezone.utc) + timedelta(days=5, hours=4),
        location_name="Aviemore Centre",
        is_ticketing_enabled=True,
        organizer_id=organizer_user.id
    )
    tier = TicketTier(
        id="tier-ceilidh-1",
        event_id=event.id,
        name="VIP Admission",
        price=30.0,
        quantity_available=50,
        quantity_sold=0,
        max_per_order=5
    )
    test_db.add(event)
    test_db.add(tier)
    test_db.commit()

    fake_intent_data = MagicMock()
    fake_intent_data.id = "pi_test_org_alert_789"
    fake_intent_data.status = "succeeded"
    fake_intent_data.amount = 6000  # £60.00
    fake_intent_data.application_fee_amount = 300  # £3.00
    fake_intent_data.metadata = {
        "event_id": "evt-connect-org-1",
        "buyer_name": "Fiona MacPherson",
        "buyer_email": "fiona@example.com",
        "platform_fee_amount": "3.00",
        "items_json": json.dumps([{"tier_id": "tier-ceilidh-1", "quantity": 2}])
    }
    fake_intent_data.charges = MagicMock(data=[])

    fake_stripe_event = MagicMock()
    fake_stripe_event.type = "payment_intent.succeeded"
    fake_stripe_event.data.object = fake_intent_data

    with patch.object(settings, "STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_test_connect_secret"), \
         patch("stripe.Webhook.construct_event", return_value=fake_stripe_event), \
         patch("app.services.resend_email.resend_email_service.send_ticket_order_confirmation") as mock_buyer_email, \
         patch("app.services.resend_email.resend_email_service.send_organizer_ticket_sale_notification") as mock_org_email:

        response = client.post(
            "/api/webhooks/stripe-connect",
            content=b'{"id":"evt_org_alert_123"}',
            headers={"stripe-signature": "t=123,v1=signature"}
        )

        assert response.status_code == 200
        assert response.json() == {"status": "success"}

    # Verify Buyer Email was called
    mock_buyer_email.assert_called_once()
    assert mock_buyer_email.call_args.kwargs["to_email"] == "fiona@example.com"

    # Verify Organizer Sale Email was called
    mock_org_email.assert_called_once()
    org_kwargs = mock_org_email.call_args.kwargs
    assert org_kwargs["organizer_email"] == "organizer@highlandevents.co.uk"
    assert org_kwargs["event_title"] == "Cairngorm Ceilidh Night"
    assert org_kwargs["buyer_name"] == "Fiona MacPherson"
    assert org_kwargs["total_amount"] == 60.0

    # Verify In-App Notification was generated in database
    notif = test_db.exec(
        select(Notification).where(Notification.user_id == organizer_user.id)
    ).first()
    assert notif is not None
    assert notif.title == "New Ticket Sale!"
    assert "VIP Admission" in notif.message
    assert "£60.00" in notif.message
    assert notif.link == "/organizers/hub"
    assert notif.is_read is False

