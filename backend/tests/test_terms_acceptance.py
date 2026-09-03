import pytest
from uuid import uuid4
from datetime import datetime, timedelta
from unittest.mock import patch
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category

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

from app.core.limiter import limiter

@pytest.fixture(name='client')
def client_fixture(test_db: Session):
    limiter.enabled = False
    def get_session_override():
        return test_db
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
    limiter.enabled = True


def test_standard_free_event_without_ticketing_succeeds_without_terms(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='free.organizer@highland.scot',
        username='free_org',
        is_admin=False,
    )
    test_db.add(user)

    cat = Category(id=str(uuid4()).replace('-', ''), name='Community', slug='community')
    test_db.add(cat)

    venue = Venue(
        id=str(uuid4()).replace('-', ''),
        name='Inverness Library',
        address='Farraline Park',
        city='Inverness',
        postcode='IV1 1NH',
        latitude=57.4795,
        longitude=-4.2250,
        geohash='gfh0',
    )
    test_db.add(venue)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    # Standard non-ticketed event payload
    payload = {
        'title': 'Local Book Club Meeting',
        'category_id': str(cat.id),
        'venue_id': str(venue.id),
        'date_start': '2026-11-10T18:00:00Z',
        'date_end': '2026-11-10T19:30:00Z',
        'price': 'Free',
        'is_ticketing_enabled': False,
    }

    res = client.post('/api/events', json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data['title'] == 'Local Book Club Meeting'
    assert data['is_ticketing_enabled'] is False


def test_ticketed_event_without_terms_acceptance_rejected(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='ticketed.organizer@highland.scot',
        username='ticketed_org',
        is_admin=False,
    )
    test_db.add(user)

    cat = Category(id=str(uuid4()).replace('-', ''), name='Music', slug='music')
    test_db.add(cat)

    venue = Venue(
        id=str(uuid4()).replace('-', ''),
        name='Ironworks Inverness',
        address='122B Academy St',
        city='Inverness',
        postcode='IV1 1LX',
        latitude=57.4800,
        longitude=-4.2260,
        geohash='gfh0',
    )
    test_db.add(venue)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    # 1. Payload with terms_accepted omitted
    payload_omitted = {
        'title': 'Highland Ceilidh Night',
        'category_id': str(cat.id),
        'venue_id': str(venue.id),
        'date_start': '2026-11-15T19:00:00Z',
        'date_end': '2026-11-15T23:00:00Z',
        'is_ticketing_enabled': True,
        'ticket_tiers': [
            {'name': 'Adult', 'price': 15.00, 'quantity_available': 100, 'max_per_order': 6}
        ]
    }
    res1 = client.post('/api/events', json=payload_omitted)
    assert res1.status_code == 400
    assert 'Organiser Terms of Service' in res1.json()['detail']

    # 2. Payload with terms_accepted = False
    payload_false = {
        **payload_omitted,
        'terms_accepted': False,
    }
    res2 = client.post('/api/events', json=payload_false)
    assert res2.status_code == 400
    assert 'Organiser Terms of Service' in res2.json()['detail']


def test_ticketed_event_with_terms_acceptance_succeeds(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='verified.organizer@highland.scot',
        username='verified_org',
        is_admin=False,
    )
    test_db.add(user)

    cat = Category(id=str(uuid4()).replace('-', ''), name='Music', slug='music')
    test_db.add(cat)

    venue = Venue(
        id=str(uuid4()).replace('-', ''),
        name='Eden Court',
        address='Bishops Rd',
        city='Inverness',
        postcode='IV3 5SA',
        latitude=57.4720,
        longitude=-4.2320,
        geohash='gfh0',
    )
    test_db.add(venue)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    payload = {
        'title': 'Highland Symphony Orchestra',
        'category_id': str(cat.id),
        'venue_id': str(venue.id),
        'date_start': '2026-12-01T19:30:00Z',
        'date_end': '2026-12-01T22:00:00Z',
        'is_ticketing_enabled': True,
        'terms_accepted': True,
        'ticket_tiers': [
            {'name': 'Stalls', 'price': 22.00, 'quantity_available': 200, 'max_per_order': 4}
        ]
    }

    res = client.post('/api/events', json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data['title'] == 'Highland Symphony Orchestra'
    assert data['is_ticketing_enabled'] is True
    assert len(data['ticket_tiers']) == 1


def test_enabling_ticketing_on_event_update_requires_terms(client: TestClient, test_db: Session):
    user = User(
        id=str(uuid4()).replace('-', ''),
        email='updater.organizer@highland.scot',
        username='updater_org',
        is_admin=False,
    )
    test_db.add(user)

    cat = Category(id=str(uuid4()).replace('-', ''), name='Workshop', slug='workshop')
    test_db.add(cat)

    venue = Venue(
        id=str(uuid4()).replace('-', ''),
        name='Strathpeffer Pavilion',
        address='The Square',
        city='Strathpeffer',
        postcode='IV14 9DL',
        latitude=57.5878,
        longitude=-4.5385,
        geohash='gfh0',
    )
    test_db.add(venue)
    test_db.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    # 1. Create a standard non-ticketed event via API
    create_res = client.post('/api/events', json={
        'title': 'Craft Workshop',
        'category_id': str(cat.id),
        'venue_id': str(venue.id),
        'date_start': '2026-11-20T10:00:00Z',
        'date_end': '2026-11-20T14:00:00Z',
        'price': 'Free',
        'is_ticketing_enabled': False,
    })
    assert create_res.status_code == 201, create_res.text
    event_id = create_res.json()['id']

    # 2. Attempt to enable ticketing on update without terms_accepted -> 400
    res1 = client.put(f'/api/events/{event_id}', json={
        'is_ticketing_enabled': True,
    })
    assert res1.status_code == 400
    assert 'Organiser Terms of Service' in res1.json()['detail']

    # 3. Update with terms_accepted=True -> 200
    res2 = client.put(f'/api/events/{event_id}', json={
        'is_ticketing_enabled': True,
        'terms_accepted': True,
    })
    assert res2.status_code == 200, res2.text
    assert res2.json()['is_ticketing_enabled'] is True
