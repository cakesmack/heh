import json
import pytest
from datetime import datetime
from uuid import uuid4
from unittest.mock import patch, AsyncMock
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.venue import Venue
from app.models.category import Category
from app.models.report import Report
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


def test_first_time_organizer_update_triggers_review_and_report(client: TestClient, test_db: Session):
    """
    When a first-time organizer (trust_level=0, non-trusted) updates a published event,
    the event reverts to pending with moderation_reason='First-time organizer account creation review',
    the notification email receives this exact reason, and a Report record is created.
    """
    user_id = str(uuid4()).replace('-', '')
    user = User(
        id=user_id,
        email='sarah.mawson@highlandcrafts.scot',
        username='sarah_mawson',
        trust_level=0,
        is_trusted_organizer=False,
        is_admin=False
    )
    test_db.add(user)

    cat = Category(id=str(uuid4()).replace('-', ''), name='Crafts', slug='crafts')
    test_db.add(cat)

    venue = Venue(
        id=str(uuid4()).replace('-', ''),
        name='Westfield Croft Studio',
        address='Westfield Road',
        city='Huntly',
        postcode='AB54 4EU',
        latitude=57.4,
        longitude=-2.8,
        status='UNVERIFIED'
    )
    test_db.add(venue)
    test_db.commit()

    # User creates initial event (auto-publishes)
    event_id = str(uuid4()).replace('-', '')
    event = Event(
        id=event_id,
        title='Tablet Weaving Workshop with Sarah Mawson',
        description='Learn traditional tablet weaving techniques using natural wool.',
        date_start=datetime(2026, 10, 15, 10, 0, 0),
        date_end=datetime(2026, 10, 15, 14, 0, 0),
        category_id=cat.id,
        venue_id=venue.id,
        organizer_id=user.id,
        status='published'
    )
    test_db.add(event)
    test_db.commit()

    def get_user_override():
        return user
    app.dependency_overrides[get_current_user] = get_user_override

    mock_mod_notify = AsyncMock(return_value=True)

    with patch.object(resend_email_service, 'send_moderation_required_notification', mock_mod_notify):
        res = client.put(f'/api/events/{event.id}', json={
            'title': 'Tablet Weaving Workshop with Sarah Mawson (Updated)',
            'description': 'Updated details: learn advanced tablet weaving patterns.'
        })

    assert res.status_code == 200, res.text
    updated_event = test_db.get(Event, event.id)
    assert updated_event.status == 'pending'
    assert updated_event.moderation_reason == 'First-time organizer account creation review'

    # Check notification call arguments
    assert mock_mod_notify.called
    call_args = mock_mod_notify.call_args[0]
    assert call_args[0] == updated_event.title
    assert call_args[1] == str(updated_event.id)
    assert call_args[2] == 'First-time organizer account creation review'

    # Check that Report record was created in the database
    reports = test_db.exec(
        select(Report).where(Report.target_type == 'event', Report.target_id == event.id)
    ).all()
    assert len(reports) == 1
    report = reports[0]
    assert report.reason == 'First-time organizer account creation review'
    assert report.status == 'pending'
    assert report.reporter_id == 'system'


def test_untrusted_existing_organizer_update_reason(client: TestClient, test_db: Session):
    """
    When an organizer with trust_level > 0 (not trusted_organizer) updates a published event,
    moderation_reason is 'Edited by organizer after publication'.
    """
    user_id = str(uuid4()).replace('-', '')
    user = User(
        id=user_id,
        email='established.maker@highland.scot',
        username='established_maker',
        trust_level=2,
        is_trusted_organizer=False,
        is_admin=False
    )
    test_db.add(user)

    venue = Venue(
        id=str(uuid4()).replace('-', ''),
        name='Community Hall',
        address='High Street',
        city='Inverness',
        latitude=57.48,
        longitude=-4.22,
        status='UNVERIFIED'
    )
    test_db.add(venue)
    test_db.commit()

    event_id = str(uuid4()).replace('-', '')
    event = Event(
        id=event_id,
        title='Woodcarving Masterclass',
        description='Woodcarving basics.',
        date_start=datetime(2026, 11, 1, 10, 0, 0),
        date_end=datetime(2026, 11, 1, 13, 0, 0),
        venue_id=venue.id,
        organizer_id=user.id,
        status='published'
    )
    test_db.add(event)
    test_db.commit()

    def get_user_override():
        return user
    app.dependency_overrides[get_current_user] = get_user_override

    mock_mod_notify = AsyncMock(return_value=True)

    with patch.object(resend_email_service, 'send_moderation_required_notification', mock_mod_notify):
        res = client.put(f'/api/events/{event.id}', json={
            'title': 'Woodcarving Masterclass - New Times'
        })

    assert res.status_code == 200, res.text
    updated_event = test_db.get(Event, event.id)
    assert updated_event.status == 'pending'
    assert updated_event.moderation_reason == 'Edited by organizer after publication'

    assert mock_mod_notify.called
    call_args = mock_mod_notify.call_args[0]
    assert call_args[2] == 'Edited by organizer after publication'


def test_profanity_event_creates_report_in_queue(client: TestClient, test_db: Session):
    """
    Profanity quarantined event creates a Report record in the database
    with reason='Profanity Detected'.
    """
    user_id = str(uuid4()).replace('-', '')
    user = User(
        id=user_id,
        email='poster@highland.scot',
        username='poster',
        trust_level=0,
        is_trusted_organizer=False,
        is_admin=False
    )
    test_db.add(user)

    cat = Category(id=str(uuid4()).replace('-', ''), name='Nightlife', slug='nightlife')
    test_db.add(cat)
    test_db.commit()

    def get_user_override():
        return user
    app.dependency_overrides[get_current_user] = get_user_override

    mock_send_quarantined = AsyncMock(return_value=True)

    with patch.object(resend_email_service, 'send_event_quarantined_alert', mock_send_quarantined):
        res = client.post('/api/events', json={
            'title': 'Wild Fucking Ceilidh Party',
            'description': 'Very loud music.',
            'date_start': '2026-10-20T20:00:00Z',
            'date_end': '2026-10-21T00:00:00Z',
            'category_id': str(cat.id),
            'location_name': 'Inverness Town Hall'
        })

    assert res.status_code == 201, res.text
    data = res.json()
    created_id = data['id'].replace('-', '')

    # Check Report record
    report = test_db.exec(
        select(Report).where(Report.target_type == 'event', Report.target_id == created_id)
    ).first()
    assert report is not None
    assert report.reason == 'Profanity Detected'
    assert report.status == 'pending'
    parsed_details = json.loads(report.details)
    assert 'detected_word' in parsed_details
    assert 'fuck' in parsed_details['detected_word'].lower()


def test_admin_resolve_report_publishes_event(client: TestClient, test_db: Session):
    """
    When an admin resolves a report for a pending event, the report is resolved
    and the event is automatically marked published.
    """
    admin_user = User(
        id=str(uuid4()).replace('-', ''),
        email='admin@highlandeventshub.co.uk',
        username='admin',
        is_admin=True
    )
    test_db.add(admin_user)

    event = Event(
        id=str(uuid4()).replace('-', ''),
        title='Highland Craft Fair',
        description='Craft items for sale.',
        date_start=datetime(2026, 11, 20, 10, 0, 0),
        date_end=datetime(2026, 11, 20, 16, 0, 0),
        status='pending',
        moderation_reason='First-time organizer account creation review'
    )
    test_db.add(event)

    report = Report(
        target_type='event',
        target_id=event.id,
        reason='First-time organizer account creation review',
        status='pending',
        reporter_id='system'
    )
    test_db.add(report)
    test_db.commit()

    def get_user_override():
        return admin_user
    app.dependency_overrides[get_current_user] = get_user_override

    res = client.post(f'/api/moderation/reports/{report.id}/resolve?action=resolve')
    assert res.status_code == 200, res.text

    test_db.refresh(report)
    test_db.refresh(event)
    assert report.status == 'resolved'
    assert event.status == 'published'
    assert event.moderation_reason is None


def test_admin_moderate_event_resolves_report(client: TestClient, test_db: Session):
    """
    When an admin approves an event via /api/moderation/events/{id}/moderate,
    the event is published and any pending Report is marked resolved.
    """
    admin_user = User(
        id=str(uuid4()).replace('-', ''),
        email='admin2@highlandeventshub.co.uk',
        username='admin2',
        is_admin=True
    )
    test_db.add(admin_user)

    event = Event(
        id=str(uuid4()).replace('-', ''),
        title='Traditional Fiddle Masterclass',
        description='Fiddle tunes.',
        date_start=datetime(2026, 11, 25, 14, 0, 0),
        date_end=datetime(2026, 11, 25, 16, 0, 0),
        status='pending_review',
        moderation_reason='Contains: fiddle'
    )
    test_db.add(event)

    report = Report(
        target_type='event',
        target_id=event.id,
        reason='Profanity Detected',
        status='pending',
        reporter_id='system'
    )
    test_db.add(report)
    test_db.commit()

    def get_user_override():
        return admin_user
    app.dependency_overrides[get_current_user] = get_user_override

    mock_send_approved = AsyncMock(return_value=True)

    with patch.object(resend_email_service, 'send_event_approved', mock_send_approved):
        res = client.post(f'/api/moderation/events/{event.id}/moderate', json={'action': 'approve'})

    assert res.status_code == 200, res.text
    test_db.refresh(event)
    test_db.refresh(report)
    assert event.status == 'published'
    assert event.moderation_reason is None
    assert report.status == 'resolved'


def test_moderation_queue_and_admin_events_pending_parity(client: TestClient, test_db: Session):
    """
    Both GET /api/moderation/events/pending and GET /api/admin/events?status=pending
    return events in status 'pending', 'pending_review', and 'pending_moderation'.
    """
    admin_user = User(
        id=str(uuid4()).replace('-', ''),
        email='admin3@highlandeventshub.co.uk',
        username='admin3',
        is_admin=True
    )
    test_db.add(admin_user)

    evt_pending = Event(
        id=str(uuid4()).replace('-', ''),
        title='Pending Event 1',
        description='Description 1',
        date_start=datetime(2026, 12, 1, 10, 0, 0),
        date_end=datetime(2026, 12, 1, 12, 0, 0),
        status='pending'
    )
    evt_pending_review = Event(
        id=str(uuid4()).replace('-', ''),
        title='Pending Review Event 2',
        description='Description 2',
        date_start=datetime(2026, 12, 2, 10, 0, 0),
        date_end=datetime(2026, 12, 2, 12, 0, 0),
        status='pending_review'
    )
    evt_published = Event(
        id=str(uuid4()).replace('-', ''),
        title='Published Event 3',
        description='Description 3',
        date_start=datetime(2026, 12, 3, 10, 0, 0),
        date_end=datetime(2026, 12, 3, 12, 0, 0),
        status='published'
    )
    test_db.add_all([evt_pending, evt_pending_review, evt_published])
    test_db.commit()

    def get_user_override():
        return admin_user
    app.dependency_overrides[get_current_user] = get_user_override

    # 1. Moderation API pending events
    res_mod = client.get('/api/moderation/events/pending')
    assert res_mod.status_code == 200, res_mod.text
    mod_ids = [e['id'] for e in res_mod.json()]
    assert evt_pending.id in mod_ids
    assert evt_pending_review.id in mod_ids
    assert evt_published.id not in mod_ids

    # 2. Admin events filter status=pending
    res_admin = client.get('/api/admin/events?status=pending')
    assert res_admin.status_code == 200, res_admin.text
    admin_items = res_admin.json()['data']
    admin_ids = [e['id'] for e in admin_items]
    assert evt_pending.id in admin_ids
    assert evt_pending_review.id in admin_ids
    assert evt_published.id not in admin_ids
