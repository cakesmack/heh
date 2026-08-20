import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.api.auth import get_current_user
from app.api.admin import require_admin
from app.models.user import User
from app.models.event import Event
from app.models.organizer import Organizer
from app.models.organizer_stripe_account import OrganizerStripeAccount
from app.services import stripe_service

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return 'JSON'

@pytest.fixture(name='test_db')
def test_db_fixture():
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture(name='client')
def client_fixture(test_db: Session):
    def get_session_override():
        return test_db
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_automatic_seller_verification_on_stripe_sync(client: TestClient, test_db: Session):
    # 1. Create a standard registered user with Tier 1 status
    user = User(
        id='user_auto_seller_1',
        email='new.organizer@highland.scot',
        username='highland_org',
        seller_tier=1,
        seller_status='none'
    )
    test_db.add(user)

    org = Organizer(
        id='org_auto_1',
        name='Highland Ceilidh Troupe',
        slug='highland-ceilidh-troupe',
        user_id=user.id,
        is_verified=False
    )
    test_db.add(org)

    stripe_acc = OrganizerStripeAccount(
        id='stripe_acc_auto_1',
        organizer_profile_id=org.id,
        stripe_account_id='acct_mock_auto_123',
        charges_enabled=False,
        payouts_enabled=False
    )
    test_db.add(stripe_acc)
    test_db.commit()

    # User starts unverified
    assert user.seller_tier == 1
    assert user.seller_status == 'none'
    assert org.is_verified is False

    # 2. Simulate Stripe Connect sync with active charges
    fake_stripe_account = MagicMock()
    fake_stripe_account.charges_enabled = True
    fake_stripe_account.payouts_enabled = True
    fake_stripe_account.details_submitted = True

    with patch('stripe.Account.retrieve', return_value=fake_stripe_account),          patch.object(stripe_service.settings, 'STRIPE_SECRET_KEY', 'sk_test_mock'):
        
        db_acc = stripe_service.sync_account_status('acct_mock_auto_123', test_db)

    # 3. Verify user and organizer are immediately auto-verified without admin intervention
    test_db.refresh(user)
    test_db.refresh(org)
    assert db_acc.charges_enabled is True
    assert db_acc.payouts_enabled is True
    assert org.is_verified is True
    assert user.seller_tier == 2
    assert user.seller_status == 'approved'

def test_admin_seller_oversight_directory_and_moderation(client: TestClient, test_db: Session):
    admin = User(
        id='admin_seller_mod_1',
        email='admin@heh.com',
        username='admin_mod',
        is_admin=True
    )
    test_db.add(admin)

    # Seller 1: Active & Connected
    seller_active = User(
        id='seller_active_1',
        email='active.seller@example.com',
        username='active_seller',
        seller_tier=2,
        seller_status='approved'
    )
    test_db.add(seller_active)
    org_active = Organizer(
        id='org_active_1',
        name='Active Org',
        slug='active-org',
        user_id=seller_active.id,
        is_verified=True
    )
    test_db.add(org_active)
    stripe_active = OrganizerStripeAccount(
        id='stripe_active_1',
        organizer_profile_id=org_active.id,
        stripe_account_id='acct_active_1',
        charges_enabled=True,
        payouts_enabled=True
    )
    test_db.add(stripe_active)
    test_db.commit()

    def get_admin_override():
        return admin
    app.dependency_overrides[require_admin] = get_admin_override

    # 1. Test directory listing
    res_dir = client.get('/api/admin/sellers/directory')
    assert res_dir.status_code == 200
    dir_data = res_dir.json()
    assert dir_data['stats']['active_verified'] >= 1
    assert any(s['email'] == 'active.seller@example.com' and s['is_auto_verified'] for s in dir_data['sellers'])

    # 2. Test freeze moderation action
    res_freeze = client.post(f'/api/admin/sellers/{seller_active.id}/freeze', json={'reason': 'Suspicious charge activity'})
    assert res_freeze.status_code == 200
    test_db.refresh(seller_active)
    test_db.refresh(org_active)
    assert seller_active.seller_status == 'frozen'
    assert seller_active.seller_tier == 1
    assert org_active.is_verified is False

    # 3. Test restore / approve moderation action
    res_restore = client.post(f'/api/admin/sellers/{seller_active.id}/approve')
    assert res_restore.status_code == 200
    test_db.refresh(seller_active)
    test_db.refresh(org_active)
    assert seller_active.seller_status == 'approved'
    assert seller_active.seller_tier == 2
    assert org_active.is_verified is True
