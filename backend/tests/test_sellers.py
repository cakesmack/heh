import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import patch, MagicMock
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.organizer import Organizer
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

def test_seller_status_and_onboarding_flow(test_db: Session):
    raw_user_id = str(uuid4())
    user_id = normalize_uuid(raw_user_id)
    user = User(
        id=user_id,
        email="organizer@example.com",
        username="highlandorg",
        seller_tier=1,
        seller_status="none",
    )
    test_db.add(user)
    test_db.commit()

    def get_session_override():
        return test_db

    def get_current_user_override():
        return user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_user_override
    client = TestClient(app)

    try:
        # 1. Check initial seller status (Not connected)
        res = client.get("/api/sellers/status")
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["stripe_account"] is None

        # 2. Trigger Stripe Connect onboarding with mocked stripe service
        with patch("app.services.stripe_service.create_connect_account", return_value="acct_mock_123"), \
             patch("app.services.stripe_service.create_account_onboarding_link", return_value="https://connect.stripe.com/setup/s/mock_token"):
            onboard_res = client.post("/api/sellers/stripe-connect/onboard")
            assert onboard_res.status_code == 200, onboard_res.text
            onboard_data = onboard_res.json()
            assert onboard_data["url"] == "https://connect.stripe.com/setup/s/mock_token"

        # Check that user was approved and Stripe account was recorded
        test_db.refresh(user)
        assert user.seller_tier == 2
        assert user.seller_status == "approved"

        # 3. Simulate returning from Stripe with charges and payouts enabled
        stripe_acc = test_db.exec(select(OrganizerStripeAccount)).first()
        assert stripe_acc is not None
        assert stripe_acc.stripe_account_id == "acct_mock_123"
        stripe_acc.charges_enabled = True
        stripe_acc.payouts_enabled = True
        test_db.add(stripe_acc)
        test_db.commit()

        # 4. Query status again -> should report verified Stripe account
        status_res = client.get("/api/sellers/status")
        assert status_res.status_code == 200
        verified_data = status_res.json()
        assert verified_data["stripe_account"] is not None
        assert verified_data["stripe_account"]["charges_enabled"] is True
        assert verified_data["stripe_account"]["payouts_enabled"] is True

        # 5. Check dashboard link endpoint
        dash_res = client.get("/api/sellers/stripe-connect/dashboard-link")
        assert dash_res.status_code == 200
        assert "dashboard.stripe.com" in dash_res.json()["url"]

    finally:
        app.dependency_overrides.clear()
