import pytest
from uuid import uuid4
from datetime import datetime
from unittest.mock import patch, AsyncMock
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.api.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category
from app.models.ticket_tier import TicketTier

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

def test_non_admin_allowed_stripe_onboarding(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='regular.organizer@highland.scot',
        username='regular_org',
        is_admin=False,
        seller_tier=1,
    )
    test_db.add(user)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    with patch('app.services.stripe_service.create_connect_account', return_value='acct_ga_mock_123'), \
         patch('app.services.stripe_service.create_account_onboarding_link', return_value='https://connect.stripe.com/setup/s/ga_mock_token'):
        res = client.post('/api/sellers/stripe-connect/onboard')
        assert res.status_code == 200, res.text
        data = res.json()
        assert data['url'] == 'https://connect.stripe.com/setup/s/ga_mock_token'

def test_non_admin_allowed_seller_request_access(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='regular.user@highland.scot',
        username='regular_user',
        is_admin=False,
    )
    test_db.add(user)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    res = client.post('/api/sellers/request-access')
    assert res.status_code == 200, res.text
    data = res.json()
    assert data['seller_status'] == 'approved'
    assert data['seller_tier'] == 2

def test_non_admin_allowed_creating_event_with_ticket_tiers(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='regular.creator@highland.scot',
        username='regular_creator',
        is_admin=False,
    )
    test_db.add(user)

    cat = Category(id=str(uuid4()).replace('-', ''), name='Theatre', slug='theatre')
    test_db.add(cat)

    venue = Venue(
        id=str(uuid4()).replace('-', ''),
        name='Macphail Centre',
        address='Ullapool',
        city='Ullapool',
        postcode='IV26 2AY',
        latitude=57.8954,
        longitude=-5.1584,
        geohash='gfh0',
    )
    test_db.add(venue)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    event_payload = {
        'title': 'Highland Play',
        'category_id': str(cat.id),
        'venue_id': str(venue.id),
        'date_start': '2026-10-01T19:00:00Z',
        'date_end': '2026-10-01T21:00:00Z',
        'is_ticketing_enabled': True,
        'terms_accepted': True,
        'ticket_tiers': [
            {
                'name': 'General Admission',
                'price': 12.50,
                'quantity_available': 50,
                'max_per_order': 4,
            }
        ]
    }

    res = client.post('/api/events', json=event_payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data['is_ticketing_enabled'] is True
    assert len(data['ticket_tiers']) == 1
    assert data['ticket_tiers'][0]['name'] == 'General Admission'

def test_non_admin_allowed_direct_tier_management_for_own_event(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='regular.editor@highland.scot',
        username='regular_editor',
        is_admin=False,
    )
    test_db.add(user)

    event = Event(
        id=str(uuid4()).replace('-', ''),
        title='Regular Event',
        description='A regular event',
        organizer_id=user.id,
        date_start=datetime(2026, 11, 1, 19, 0),
        date_end=datetime(2026, 11, 1, 21, 0),
        status='published'
    )
    test_db.add(event)
    test_db.commit()

    app.dependency_overrides[get_session] = lambda: test_db
    app.dependency_overrides[get_current_user] = lambda: user

    tier_payload = {
        'name': 'VIP Tier',
        'price': 25.00,
        'quantity_available': 20,
        'max_per_order': 2
    }

    res = client.post(f'/api/events/{event.id}/tiers', json=tier_payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data['name'] == 'VIP Tier'
    assert data['price'] == 25.00

def test_non_admin_blocked_from_managing_other_users_event_tiers(client: TestClient, test_db: Session):
    owner = User(
        id=str(uuid4()).replace('-', ''),
        email='owner@highland.scot',
        username='owner_user',
        is_admin=False,
    )
    attacker = User(
        id=str(uuid4()).replace('-', ''),
        email='attacker@highland.scot',
        username='attacker_user',
        is_admin=False,
    )
    test_db.add(owner)
    test_db.add(attacker)

    event = Event(
        id=str(uuid4()).replace('-', ''),
        title='Owner Event',
        organizer_id=owner.id,
        date_start=datetime(2026, 11, 1, 19, 0),
        date_end=datetime(2026, 11, 1, 21, 0),
        status='published'
    )
    test_db.add(event)
    test_db.commit()

    app.dependency_overrides[get_session] = lambda: test_db
    app.dependency_overrides[get_current_user] = lambda: attacker

    tier_payload = {
        'name': 'Hacked Tier',
        'price': 1.00,
        'quantity_available': 10,
        'max_per_order': 1
    }

    res = client.post(f'/api/events/{event.id}/tiers', json=tier_payload)
    assert res.status_code == 403, res.text
    assert 'Not authorized' in res.json()['detail']

def test_single_session_and_36h_constraint_enforced_for_standard_users(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='user@highland.scot',
        username='user1',
        is_admin=False,
    )
    test_db.add(user)

    cat = Category(id=str(uuid4()).replace('-', ''), name='Festivals', slug='festivals')
    test_db.add(cat)

    venue = Venue(
        id=str(uuid4()).replace('-', ''),
        name='Highland Grounds',
        address='Inverness',
        city='Inverness',
        postcode='IV1 1AA',
        latitude=57.4778,
        longitude=-4.2247,
        geohash='gfh1',
    )
    test_db.add(venue)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    # Event > 36 hours
    long_event_payload = {
        'title': '3 Day Festival',
        'category_id': str(cat.id),
        'venue_id': str(venue.id),
        'date_start': '2026-10-01T09:00:00Z',
        'date_end': '2026-10-04T23:00:00Z',
        'is_ticketing_enabled': True,
        'terms_accepted': True,
        'ticket_tiers': [{'name': 'Weekend Pass', 'price': 80.0, 'quantity_available': 100, 'max_per_order': 2}]
    }

    res = client.post('/api/events', json=long_event_payload)
    assert res.status_code == 400, res.text
    assert '36 hours' in res.json()['detail']
