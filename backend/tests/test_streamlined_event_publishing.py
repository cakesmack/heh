import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import patch, AsyncMock
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category
from app.services.resend_email import resend_email_service

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

def test_clean_event_submission_instant_publishing(client: TestClient, test_db: Session):
    # Regular user with 0 prior events and trust_level=0 (probation gate removed)
    user_id = str(uuid4()).replace('-', '')
    user = User(
        id=user_id,
        email='regular.host@highland.scot',
        username='regular_host',
        trust_level=0,
        is_trusted_organizer=False,
        is_admin=False
    )
    test_db.add(user)

    cat_id = str(uuid4()).replace('-', '')
    category = Category(id=cat_id, name='Music', slug='music')
    test_db.add(category)

    venue_id = str(uuid4()).replace('-', '')
    venue = Venue(
        id=venue_id,
        name='Strathpeffer Pavilion',
        address='The Square',
        city='Strathpeffer',
        postcode='IV14 9DL',
        latitude=57.587,
        longitude=-4.538
    )
    test_db.add(venue)
    test_db.commit()

    def get_user_override():
        return user
    app.dependency_overrides[get_current_user] = get_user_override

    event_payload = {
        'title': 'Highland Summer Acoustic Folk Night',
        'description': 'An evening of traditional fiddle, accordion, and Gaelic songs.',
        'date_start': '2026-09-10T19:00:00Z',
        'date_end': '2026-09-10T22:00:00Z',
        'category_id': str(category.id),
        'venue_id': str(venue.id),
        'price': '10.00',
    }

    mock_send_published = AsyncMock(return_value=True)
    mock_send_approved = AsyncMock(return_value=True)

    with patch.object(resend_email_service, 'send_new_event_notification', mock_send_published),          patch.object(resend_email_service, 'send_event_approved', mock_send_approved):
        
        res = client.post('/api/events', json=event_payload)

    assert res.status_code == 201, res.text
    data = res.json()
    assert data['status'] == 'published'
    assert data['title'] == 'Highland Summer Acoustic Folk Night'

    # Check notification was dispatched
    assert mock_send_published.called or mock_send_approved.called


def test_profanity_event_quarantine_in_pending_review(client: TestClient, test_db: Session):
    user_id = str(uuid4()).replace('-', '')
    user = User(
        id=user_id,
        email='flagged.user@highland.scot',
        username='flagged_user',
        trust_level=0,
        is_trusted_organizer=False,
        is_admin=False
    )
    test_db.add(user)

    cat_id = str(uuid4()).replace('-', '')
    category = Category(id=cat_id, name='Party', slug='party')
    test_db.add(category)

    venue_id = str(uuid4()).replace('-', '')
    venue = Venue(
        id=venue_id,
        name='Eden Court Theatre',
        address='Bishops Road',
        city='Inverness',
        postcode='IV3 5SA',
        latitude=57.473,
        longitude=-4.230
    )
    test_db.add(venue)
    test_db.commit()

    def get_user_override():
        return user
    app.dependency_overrides[get_current_user] = get_user_override

    # Trigger profanity filter with an explicit keyword in title/description
    event_payload = {
        'title': 'Wild Fucking Ceilidh Party',
        'description': 'A crazy loud party with lots of noise.',
        'date_start': '2026-09-20T20:00:00Z',
        'date_end': '2026-09-21T00:00:00Z',
        'category_id': str(category.id),
        'venue_id': str(venue.id),
        'price': '15.00',
    }

    mock_send_quarantined = AsyncMock(return_value=True)

    with patch.object(resend_email_service, 'send_event_quarantined_alert', mock_send_quarantined):
        res = client.post('/api/events', json=event_payload)

    assert res.status_code == 201, res.text
    data = res.json()
    assert data['status'] == 'pending_review'
    assert data['moderation_reason'] is not None

    # Check quarantine alert notification
    assert mock_send_quarantined.called
