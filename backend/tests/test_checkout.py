import pytest
from datetime import datetime, timedelta
from uuid import uuid4
import stripe
from unittest.mock import patch, MagicMock
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.models.user import User
from app.models.event import Event
from app.models.ticket_tier import TicketTier
from app.models.organizer_stripe_account import OrganizerStripeAccount
from app.core.utils import normalize_uuid

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


def test_checkout_create_payment_intent_event_lookup_and_paths(client: TestClient, test_db: Session):
    # Setup test seller user and Stripe account
    raw_user_id = str(uuid4())
    user_id = normalize_uuid(raw_user_id)
    user = User(
        id=user_id,
        email="seller@example.com",
        username="seller",
        seller_tier=2,
        seller_status="approved",
    )
    test_db.add(user)
    
    from app.models.organizer import Organizer
    
    org_profile = Organizer(
        id=str(uuid4()).replace("-", ""),
        name="Highland Ceilidh Club",
        slug="highland-ceilidh-club",
        user_id=user_id,
    )
    test_db.add(org_profile)
    test_db.flush()

    stripe_acc = OrganizerStripeAccount(
        id=str(uuid4()).replace("-", ""),
        organizer_profile_id=org_profile.id,
        stripe_account_id="acct_test123",
        charges_enabled=True,
        payouts_enabled=True,
    )
    test_db.add(stripe_acc)

    # Create event with unhyphenated ID and a slug
    raw_event_id = str(uuid4())
    event_id = normalize_uuid(raw_event_id)
    event = Event(
        id=event_id,
        title="Highland Ceilidh Night",
        slug="highland-ceilidh-night",
        date_start=datetime.utcnow() + timedelta(days=10),
        date_end=datetime.utcnow() + timedelta(days=10, hours=4),
        organizer_id=user_id,
        is_ticketing_enabled=True,
        sales_frozen=False,
    )
    test_db.add(event)
    test_db.flush()

    tier = TicketTier(
        id="tier_free_1",
        event_id=event.id,
        name="Free General Admission",
        price=0.0,
        quantity_available=100,
        quantity_sold=0,
        max_per_order=4,
    )
    test_db.add(tier)
    test_db.commit()

    # 1. Test request using unhyphenated event ID (without trailing slash)
    res = client.post(
        "/api/ticketing/checkout/create-payment-intent",
        json={
            "event_id": event.id,
            "items": [{"tier_id": "tier_free_1", "quantity": 2}],
            "buyer_name": "John Doe",
            "buyer_email": "john@example.com",
        }
    )
    print("RES STATUS:", res.status_code, res.text)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data.get("free_order") is True
    assert "order_ref" in data

    # 2. Test request using event slug
    res_slug = client.post(
        "/api/ticketing/checkout/create-payment-intent",
        json={
            "event_id": "highland-ceilidh-night",
            "items": [{"tier_id": "tier_free_1", "quantity": 1}],
            "buyer_name": "Jane Doe",
            "buyer_email": "jane@example.com",
        }
    )
    assert res_slug.status_code == 200, res_slug.text
    assert res_slug.json().get("free_order") is True

    # 3. Test request using raw UUID with hyphens
    hyphenated_uuid = f"{event_id[:8]}-{event_id[8:12]}-{event_id[12:16]}-{event_id[16:20]}-{event_id[20:]}"
    res_hyphen = client.post(
        "/api/ticketing/checkout/create-payment-intent",
        json={
            "event_id": hyphenated_uuid,
            "items": [{"tier_id": "tier_free_1", "quantity": 1}],
            "buyer_name": "Bob Doe",
            "buyer_email": "bob@example.com",
        }
    )
    assert res_hyphen.status_code == 200, res_hyphen.text
    assert res_hyphen.json().get("free_order") is True

    # 4. Test with trailing slash URL
    res_slash = client.post(
        "/api/ticketing/checkout/create-payment-intent/",
        json={
            "event_id": event.id,
            "items": [{"tier_id": "tier_free_1", "quantity": 1}],
            "buyer_name": "Alice Doe",
            "buyer_email": "alice@example.com",
        }
    )
    assert res_slash.status_code == 200, res_slash.text
    assert res_slash.json().get("free_order") is True


def test_intent_status_from_db(client: TestClient, test_db: Session):
    from app.models.order import Order
    order = Order(
        order_ref="HEH-TEST99",
        event_id="event_123",
        buyer_email="buyer@example.com",
        buyer_name="Buyer",
        total_amount=25.0,
        platform_fee_amount=1.5,
        stripe_payment_intent_id="pi_test_intent_123",
        status="completed"
    )
    test_db.add(order)
    test_db.commit()

    res = client.get("/api/ticketing/checkout/intent-status/pi_test_intent_123")
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") == "succeeded"
    assert data.get("order_ref") == "HEH-TEST99"


def test_intent_status_fallback_not_found(client: TestClient):
    with patch("stripe.PaymentIntent.retrieve", side_effect=stripe.error.InvalidRequestError("No such payment_intent", "param")):
        res = client.get("/api/ticketing/checkout/intent-status/pi_nonexistent_456")
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "processing"


def test_buyer_orders_endpoint(client: TestClient, test_db: Session):
    from app.api.auth import get_current_user
    from app.models.user import User
    from app.models.order import Order
    from app.models.event import Event
    from app.models.venue import Venue
    from app.models.ticket import Ticket
    from app.models.ticket_tier import TicketTier

    user = User(
        id="buyer_user_123",
        email="buyer@test.com",
        username="buyeruser",
    )
    test_db.add(user)

    venue = Venue(
        id="venue_123",
        name="Strathpeffer Pavilion",
        address="The Square, Strathpeffer",
        latitude=57.58,
        longitude=-4.53,
    )
    test_db.add(venue)

    event = Event(
        id="event_with_venue",
        title="Highland Gathering",
        date_start=datetime.now() + timedelta(days=5),
        date_end=datetime.now() + timedelta(days=5, hours=4),
        venue_id=venue.id,
    )
    test_db.add(event)

    tier = TicketTier(
        id="tier_vip_1",
        event_id=event.id,
        name="VIP Pass",
        price=35.0,
        quantity_available=50,
        quantity_sold=1,
    )
    test_db.add(tier)

    order = Order(
        id="order_123",
        order_ref="HEH-VIP99",
        event_id=event.id,
        buyer_user_id=user.id,
        buyer_email="buyer@test.com",
        buyer_name="Buyer User",
        total_amount=35.0,
        platform_fee_amount=2.0,
        status="completed",
    )
    test_db.add(order)

    ticket = Ticket(
        order_id=order.id,
        tier_id=tier.id,
        qr_token="qr_test_token_123",
        status="valid",
    )
    test_db.add(ticket)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user
    try:
        res = client.get("/api/ticketing/buyer/orders")
        assert res.status_code == 200, res.text
        data = res.json()
        assert "orders" in data
        assert len(data["orders"]) == 1
        assert data["orders"][0]["order_ref"] == "HEH-VIP99"
        assert data["orders"][0]["venue_name"] == "Strathpeffer Pavilion"
        assert data["orders"][0]["tickets"][0]["tier_name"] == "VIP Pass"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


