import pytest
from datetime import datetime, timedelta
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from app.main import app
from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.ticket_tier import TicketTier

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


def test_scanner_activation_and_validation(client: TestClient, test_db: Session):
    # Setup organizer user with seller_tier=2
    organizer = User(
        id="org_user_1",
        email="organizer@highland.com",
        username="organizer1",
        seller_tier=2,
    )
    test_db.add(organizer)

    event = Event(
        id="scan_event_1",
        title="Ceilidh Night",
        date_start=datetime.now() + timedelta(days=1),
        date_end=datetime.now() + timedelta(days=1, hours=3),
        organizer_id=organizer.id,
        is_ticketing_enabled=True,
    )
    test_db.add(event)

    tier = TicketTier(
        id="tier_ga_1",
        event_id=event.id,
        name="General Admission",
        price=15.0,
        quantity_available=100,
        quantity_sold=1,
    )
    test_db.add(tier)

    order = Order(
        id="order_scan_1",
        order_ref="HEH-SCAN01",
        event_id=event.id,
        buyer_name="Jamie Fraser",
        buyer_email="jamie@outlander.com",
        total_amount=15.0,
        status="completed",
    )
    test_db.add(order)

    ticket = Ticket(
        id="ticket_scan_1",
        order_id=order.id,
        tier_id=tier.id,
        qr_token="qr_secret_token_12345",
        status="valid",
    )
    test_db.add(ticket)
    test_db.commit()

    # 1. Scanner Inactive before activation
    app.dependency_overrides[get_current_user] = lambda: organizer
    try:
        events_res = client.get("/api/ticketing/organizer/scanner/events")
        assert events_res.status_code == 200, events_res.text
        events_data = events_res.json()
        assert len(events_data["events"]) == 1
        assert events_data["events"][0]["is_scanner_active"] is False

        # Try to validate without token -> should fail
        val_res = client.post("/api/ticketing/scan/validate-key", json={"event_id": event.id, "token": "wrong_key"})
        assert val_res.status_code == 403

        # 2. Activate Scanner
        act_res = client.post(f"/api/ticketing/organizer/events/{event.id}/activate-scanner")
        assert act_res.status_code == 200, act_res.text
        act_data = act_res.json()
        assert act_data["status"] == "active"
        token = act_data["scanner_access_key"]
        assert token is not None

        # 3. Validate Scanner Key
        key_res = client.post("/api/ticketing/scan/validate-key", json={"event_id": event.id, "token": token})
        assert key_res.status_code == 200
        assert key_res.json()["valid"] is True
        assert key_res.json()["total_sold"] == 1
        assert key_res.json()["total_checked_in"] == 0

        # 4. Scan Ticket (Valid)
        scan_res = client.post("/api/ticketing/scan/validate-ticket", json={
            "event_id": event.id,
            "token": token,
            "qr_token": "qr_secret_token_12345"
        })
        assert scan_res.status_code == 200
        scan_data = scan_res.json()
        assert scan_data["status"] == "valid"
        assert scan_data["buyer_name"] == "Jamie Fraser"

        # 5. Scan Same Ticket Again (Already Used)
        scan_again_res = client.post("/api/ticketing/scan/validate-ticket", json={
            "event_id": event.id,
            "token": token,
            "qr_token": "qr_secret_token_12345"
        })
        assert scan_again_res.status_code == 200
        assert scan_again_res.json()["status"] == "already_used"

        # 6. Test Manual Check-In via Order Ref
        # Add another ticket to test manual lookup by order ref
        ticket2 = Ticket(
            id="ticket_scan_2",
            order_id=order.id,
            tier_id=tier.id,
            qr_token="qr_secret_token_67890",
            status="valid",
        )
        test_db.add(ticket2)
        test_db.commit()

        scan_ref_res = client.post("/api/ticketing/scan/validate-ticket", json={
            "event_id": event.id,
            "token": token,
            "qr_token": "HEH-SCAN01"
        })
        assert scan_ref_res.status_code == 200
        assert scan_ref_res.json()["status"] == "valid"

        # 7. Deactivate Scanner
        deact_res = client.post(f"/api/ticketing/organizer/events/{event.id}/deactivate-scanner")
        assert deact_res.status_code == 200
        assert deact_res.json()["status"] == "inactive"

        # Key should now be invalid
        key_res2 = client.post("/api/ticketing/scan/validate-key", json={"event_id": event.id, "token": token})
        assert key_res2.status_code == 403

    finally:
        app.dependency_overrides.pop(get_current_user, None)
