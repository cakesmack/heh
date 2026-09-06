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
from app.models.group_member import GroupMember
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
        is_admin=True,
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


def test_standard_non_admin_onboarding_without_organizer(test_db: Session):
    user_id = normalize_uuid(str(uuid4()))
    user = User(
        id=user_id,
        email="standard_user@example.com",
        username="standarduser",
        seller_tier=1,
        seller_status="none",
        is_admin=False,
    )
    test_db.add(user)
    test_db.commit()

    app.dependency_overrides[get_session] = lambda: test_db
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        with patch("app.services.stripe_service.create_connect_account", return_value="acct_std_123"), \
             patch("app.services.stripe_service.create_account_onboarding_link", return_value="https://connect.stripe.com/setup/s/std_token"):
            res = client.post("/api/sellers/stripe-connect/onboard")
            assert res.status_code == 200, res.text
            assert res.json()["url"] == "https://connect.stripe.com/setup/s/std_token"

        # Verify auto-created organizer profile
        created_org = test_db.exec(select(Organizer).where(Organizer.user_id == user.id)).first()
        assert created_org is not None
        assert created_org.user_id == user.id
        assert created_org.stripe_account is not None
        assert created_org.stripe_account.stripe_account_id == "acct_std_123"

        # Verify user seller tier and status upgraded
        test_db.refresh(user)
        assert user.seller_tier == 2
        assert user.seller_status == "approved"
    finally:
        app.dependency_overrides.clear()


def test_standard_non_admin_onboarding_with_dashed_uuid(test_db: Session):
    user_id = normalize_uuid(str(uuid4()))
    user = User(
        id=user_id,
        email="dashed_uuid_user@example.com",
        username="dasheduser",
        seller_tier=1,
        seller_status="none",
        is_admin=False,
    )
    test_db.add(user)
    test_db.commit()

    raw_org_uuid = str(uuid4())  # contains dashes
    norm_org_id = normalize_uuid(raw_org_uuid)  # stored in DB without dashes
    org = Organizer(
        id=norm_org_id,
        name="Dashed UUID Organizer",
        slug="dashed-uuid-org",
        user_id=user.id,
    )
    test_db.add(org)
    test_db.commit()

    app.dependency_overrides[get_session] = lambda: test_db
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        with patch("app.services.stripe_service.create_connect_account", return_value="acct_dashed_123"), \
             patch("app.services.stripe_service.create_account_onboarding_link", return_value="https://connect.stripe.com/setup/s/dashed_token"):
            # Pass organizer_id formatted with dashes
            res = client.post(f"/api/sellers/stripe-connect/onboard?organizer_id={raw_org_uuid}")
            assert res.status_code == 200, res.text
            assert res.json()["url"] == "https://connect.stripe.com/setup/s/dashed_token"

        test_db.refresh(org)
        assert org.stripe_account is not None
        assert org.stripe_account.stripe_account_id == "acct_dashed_123"
    finally:
        app.dependency_overrides.clear()


def test_standard_non_admin_onboarding_with_slug(test_db: Session):
    user_id = normalize_uuid(str(uuid4()))
    user = User(
        id=user_id,
        email="slug_user@example.com",
        username="sluguser",
        seller_tier=1,
        seller_status="none",
        is_admin=False,
    )
    test_db.add(user)
    test_db.commit()

    org = Organizer(
        id=normalize_uuid(str(uuid4())),
        name="Craft Fair Organizer",
        slug="craft-fair-organizer",
        user_id=user.id,
    )
    test_db.add(org)
    test_db.commit()

    app.dependency_overrides[get_session] = lambda: test_db
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        with patch("app.services.stripe_service.create_connect_account", return_value="acct_slug_123"), \
             patch("app.services.stripe_service.create_account_onboarding_link", return_value="https://connect.stripe.com/setup/s/slug_token"):
            # Pass organizer_id as slug in JSON body
            res = client.post("/api/sellers/stripe-connect/onboard", json={"organizer_id": "craft-fair-organizer"})
            assert res.status_code == 200, res.text
            assert res.json()["url"] == "https://connect.stripe.com/setup/s/slug_token"

        test_db.refresh(org)
        assert org.stripe_account is not None
        assert org.stripe_account.stripe_account_id == "acct_slug_123"
    finally:
        app.dependency_overrides.clear()


def test_standard_non_admin_onboarding_fallback_on_unowned_or_missing_id(test_db: Session):
    user_id = normalize_uuid(str(uuid4()))
    user = User(
        id=user_id,
        email="fallback_user@example.com",
        username="fallbackuser",
        seller_tier=1,
        seller_status="none",
        is_admin=False,
    )
    test_db.add(user)
    test_db.commit()

    user_org = Organizer(
        id=normalize_uuid(str(uuid4())),
        name="User Personal Org",
        slug="user-personal-org",
        user_id=user.id,
    )
    test_db.add(user_org)
    test_db.commit()

    app.dependency_overrides[get_session] = lambda: test_db
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        with patch("app.services.stripe_service.create_connect_account", return_value="acct_fallback_123"), \
             patch("app.services.stripe_service.create_account_onboarding_link", return_value="https://connect.stripe.com/setup/s/fallback_token"):
            # Pass nonexistent/unowned organizer ID -> should fall back gracefully without 404
            res = client.post("/api/sellers/stripe-connect/onboard?organizer_id=nonexistent_or_unowned_id")
            assert res.status_code == 200, res.text
            assert res.json()["url"] == "https://connect.stripe.com/setup/s/fallback_token"

        test_db.refresh(user_org)
        assert user_org.stripe_account is not None
        assert user_org.stripe_account.stripe_account_id == "acct_fallback_123"
    finally:
        app.dependency_overrides.clear()


def test_standard_non_admin_group_member_onboarding(test_db: Session):
    owner_id = normalize_uuid(str(uuid4()))
    owner = User(
        id=owner_id,
        email="group_owner@example.com",
        username="groupowner",
        seller_tier=2,
        seller_status="approved",
        is_admin=False,
    )
    member_id = normalize_uuid(str(uuid4()))
    member = User(
        id=member_id,
        email="group_member@example.com",
        username="groupmember",
        seller_tier=1,
        seller_status="none",
        is_admin=False,
    )
    test_db.add(owner)
    test_db.add(member)
    test_db.commit()

    group_org = Organizer(
        id=normalize_uuid(str(uuid4())),
        name="Collaborative Events Org",
        slug="collab-events-org",
        user_id=owner.id,
    )
    test_db.add(group_org)
    test_db.commit()

    membership = GroupMember(
        group_id=group_org.id,
        user_id=member.id,
    )
    test_db.add(membership)
    test_db.commit()

    app.dependency_overrides[get_session] = lambda: test_db
    app.dependency_overrides[get_current_user] = lambda: member
    client = TestClient(app)

    try:
        with patch("app.services.stripe_service.create_connect_account", return_value="acct_group_123"), \
             patch("app.services.stripe_service.create_account_onboarding_link", return_value="https://connect.stripe.com/setup/s/group_token"):
            res = client.post(f"/api/sellers/stripe-connect/onboard?organizer_id={group_org.id}")
            assert res.status_code == 200, res.text
            assert res.json()["url"] == "https://connect.stripe.com/setup/s/group_token"

        test_db.refresh(group_org)
        assert group_org.stripe_account is not None
        assert group_org.stripe_account.stripe_account_id == "acct_group_123"
    finally:
        app.dependency_overrides.clear()


def test_standard_non_admin_dashboard_link(test_db: Session):
    user_id = normalize_uuid(str(uuid4()))
    user = User(
        id=user_id,
        email="dash_user@example.com",
        username="dashuser",
        seller_tier=2,
        seller_status="approved",
        is_admin=False,
    )
    test_db.add(user)
    test_db.commit()

    org = Organizer(
        id=normalize_uuid(str(uuid4())),
        name="Dashboard Test Org",
        slug="dash-test-org",
        user_id=user.id,
    )
    test_db.add(org)
    test_db.commit()

    app.dependency_overrides[get_session] = lambda: test_db
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        # Before Stripe connected -> 400
        res = client.get(f"/api/sellers/stripe-connect/dashboard-link?organizer_id={org.id}")
        assert res.status_code == 400, res.text
        assert "No Stripe account connected" in res.json()["detail"]

        # Connect Stripe account
        stripe_acc = OrganizerStripeAccount(
            organizer_profile_id=org.id,
            stripe_account_id="acct_dash_456",
            charges_enabled=True,
            payouts_enabled=True,
        )
        test_db.add(stripe_acc)
        test_db.commit()

        # After Stripe connected -> 200
        res2 = client.get(f"/api/sellers/stripe-connect/dashboard-link?organizer_id={org.id}")
        assert res2.status_code == 200, res2.text
        assert "dashboard.stripe.com" in res2.json()["url"]
    finally:
        app.dependency_overrides.clear()

