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
from app.models.notification import Notification, NotificationType

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


def test_organizer_invoices_and_tax_export(client: TestClient, test_db: Session):
    # 1. Setup organizer
    organizer = User(
        id="org_inv_user_1",
        email="invoices_org@highland.com",
        username="inv_organizer",
        seller_tier=2,
    )
    test_db.add(organizer)

    event = Event(
        id="inv_event_1",
        title="Highland Highland Gathering 2026",
        date_start=datetime(2026, 7, 15, 12, 0),
        date_end=datetime(2026, 7, 15, 18, 0),
        organizer_id=organizer.id,
        is_ticketing_enabled=True,
    )
    test_db.add(event)

    tier = TicketTier(
        id="inv_tier_1",
        event_id=event.id,
        name="Standard Admission",
        price=25.0,
        quantity_available=200,
        quantity_sold=2,
    )
    test_db.add(tier)

    order = Order(
        id="inv_order_1",
        order_ref="HEH-INV100",
        event_id=event.id,
        buyer_name="Flora MacDonald",
        buyer_email="flora@highland.scot",
        total_amount=50.0,
        platform_fee_amount=3.25,
        status="completed",
        created_at=datetime(2026, 5, 10, 14, 30)
    )
    test_db.add(order)

    ticket1 = Ticket(
        id="ticket_inv_1",
        order_id=order.id,
        tier_id=tier.id,
        qr_token="token_inv_1",
        status="valid"
    )
    ticket2 = Ticket(
        id="ticket_inv_2",
        order_id=order.id,
        tier_id=tier.id,
        qr_token="token_inv_2",
        status="valid"
    )
    test_db.add(ticket1)
    test_db.add(ticket2)
    test_db.commit()

    # 2. Test Invoices List Endpoint
    app.dependency_overrides[get_current_user] = lambda: organizer
    try:
        res = client.get("/api/ticketing/organizer/invoices")
        assert res.status_code == 200, res.text
        data = res.json()

        # Check summary
        assert data["summary"]["total_gross"] == 50.0
        assert data["summary"]["total_fees"] == 3.25
        assert data["summary"]["total_net"] == 46.75
        assert data["summary"]["total_invoices"] == 1
        assert data["summary"]["total_tickets"] == 2

        # Check invoice item
        invoices = data["invoices"]
        assert len(invoices) == 1
        inv = invoices[0]
        assert inv["invoice_ref"] == "INV-HEH-INV100"
        assert inv["order_ref"] == "HEH-INV100"
        assert inv["event_title"] == "Highland Highland Gathering 2026"
        assert inv["buyer_name"] == "Flora MacDonald"
        assert inv["total_gross"] == 50.0
        assert inv["platform_fee"] == 3.25
        assert inv["net_payout"] == 46.75
        assert inv["tax_year"] == "2026/2027"

        # 3. Test Invoices CSV Export
        csv_res = client.get("/api/ticketing/organizer/invoices/export")
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers.get("content-type", "")
        csv_content = csv_res.text
        assert "Invoice Reference,Issue Date,Tax Year (UK),Event Title" in csv_content
        assert "INV-HEH-INV100" in csv_content
        assert "Flora MacDonald" in csv_content
        assert "50.00" in csv_content
        assert "3.25" in csv_content
        assert "46.75" in csv_content

        # 4. Test Single Invoice Detail Endpoint
        detail_res = client.get(f"/api/ticketing/organizer/invoices/{order.id}")
        assert detail_res.status_code == 200, detail_res.text
        detail = detail_res.json()
        assert detail["invoice_ref"] == "INV-HEH-INV100"
        assert detail["buyer"]["name"] == "Flora MacDonald"
        assert detail["financials"]["gross_amount"] == 50.0
        assert detail["financials"]["platform_fee"] == 3.25
        assert detail["financials"]["net_payout"] == 46.75
        assert len(detail["line_items"]) == 1
        assert detail["line_items"][0]["name"] == "Standard Admission"
        assert detail["line_items"][0]["quantity"] == 2

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_organizer_hub_events_and_attendees_export(client: TestClient, test_db: Session):
    organizer = User(
        id="org_hub_user_1",
        email="hub_org@highland.com",
        username="hub_organizer",
        seller_tier=2,
    )
    test_db.add(organizer)

    event = Event(
        id="hub_event_1",
        title="Highland Gathering Ceilidh",
        date_start=datetime(2026, 8, 20, 19, 0),
        date_end=datetime(2026, 8, 20, 23, 0),
        organizer_id=organizer.id,
        is_ticketing_enabled=True,
        scanner_access_key="test_scan_key_123"
    )
    test_db.add(event)

    tier = TicketTier(
        id="hub_tier_1",
        event_id=event.id,
        name="VIP Entry",
        price=35.0,
        quantity_available=100,
        quantity_sold=1,
    )
    test_db.add(tier)

    order = Order(
        id="hub_order_1",
        order_ref="HEH-ATTEND1",
        event_id=event.id,
        buyer_name="Hamish MacLeod",
        buyer_email="hamish@highland.scot",
        total_amount=35.0,
        platform_fee_amount=2.50,
        status="completed",
        created_at=datetime(2026, 8, 1, 10, 0)
    )
    test_db.add(order)

    ticket = Ticket(
        id="ticket_hub_1",
        order_id=order.id,
        tier_id=tier.id,
        qr_token="token_hub_1",
        status="checked_in",
        checked_in_at=datetime(2026, 8, 20, 19, 30)
    )
    test_db.add(ticket)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: organizer
    try:
        # 1. Test GET /api/organizers/events
        res_org_events = client.get("/api/organizers/events")
        assert res_org_events.status_code == 200, res_org_events.text
        events_data = res_org_events.json()
        assert "events" in events_data
        assert len(events_data["events"]) == 1
        ev_item = events_data["events"][0]
        assert ev_item["id"] == "hub_event_1"
        assert ev_item["event_id"] == "hub_event_1"
        assert ev_item["title"] == "Highland Gathering Ceilidh"
        assert ev_item["total_tickets_sold"] == 1
        assert ev_item["total_checked_in"] == 1
        assert ev_item["is_scanner_active"] is True

        # 2. Test GET /api/organizers/invoices
        res_org_inv = client.get("/api/organizers/invoices")
        assert res_org_inv.status_code == 200, res_org_inv.text
        inv_data = res_org_inv.json()
        assert inv_data["summary"]["total_gross"] == 35.0
        assert len(inv_data["invoices"]) == 1

        # 3. Test GET /api/ticketing/organizer/events
        res_ticketing_events = client.get("/api/ticketing/organizer/events")
        assert res_ticketing_events.status_code == 200, res_ticketing_events.text
        assert len(res_ticketing_events.json()["events"]) == 1

        # 4. Test GET /api/ticketing/organizer/events/{event_id}/export-attendees
        res_csv = client.get(f"/api/ticketing/organizer/events/{event.id}/export-attendees")
        assert res_csv.status_code == 200, res_csv.text
        assert "text/csv" in res_csv.headers.get("content-type", "")
        assert f"attendees_{event.id}.csv" in res_csv.headers.get("content-disposition", "")
        csv_text = res_csv.text
        assert "Attendee Name,Email,Ticket Tier,Order Ref,Ticket ID,Status,Checked In At" in csv_text
        assert "Hamish MacLeod" in csv_text
        assert "hamish@highland.scot" in csv_text
        assert "VIP Entry" in csv_text
        assert "HEH-ATTEND1" in csv_text
        assert "checked_in" in csv_text

        # 5. Test GET /api/ticketing/organizer/events/{event_id}/export-guests backward compatibility
        res_guests_csv = client.get(f"/api/ticketing/organizer/events/{event.id}/export-guests")
        assert res_guests_csv.status_code == 200, res_guests_csv.text
        assert "Hamish MacLeod" in res_guests_csv.text

    finally:
        app.dependency_overrides.pop(get_current_user, None)
