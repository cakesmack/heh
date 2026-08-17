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
