import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import patch, AsyncMock
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_session
from app.api.auth import get_current_user
from app.core.security import get_current_user as core_get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.category import Category
from app.models.organizer import Organizer
from app.models.organizer_stripe_account import OrganizerStripeAccount
from app.models.ticket_tier import TicketTier
from app.models.order import Order
from app.models.ticket import Ticket
from app.core.utils import normalize_uuid

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

def test_automated_ticket_sales_cutoff_past_sale_end(client: TestClient, test_db: Session):
    user = User(
        id='user_seller_cutoff_1',
        email='seller_cutoff@example.com',
        username='seller_cutoff',
        seller_tier=2,
        seller_status='approved'
    )
    test_db.add(user)

    org = Organizer(
        id='org_profile_cutoff_1',
        user_id=user.id,
        name='Highland Festivals',
        slug='highland-festivals'
    )
    test_db.add(org)

    stripe_acc = OrganizerStripeAccount(
        id='stripe_acc_cutoff_1',
        organizer_profile_id=org.id,
        stripe_account_id='acct_mock_cutoff_1',
        charges_enabled=True,
        payouts_enabled=True,
        details_submitted=True
    )
    test_db.add(stripe_acc)

    event = Event(
        id='evt_cutoff_1',
        title='Past Sale Tier Event',
        slug='past-sale-tier-event',
        date_start=datetime.utcnow() + timedelta(days=5),
        date_end=datetime.utcnow() + timedelta(days=5, hours=3),
        organizer_id=user.id,
        organizer_profile_id=org.id,
        is_ticketing_enabled=True
    )
    test_db.add(event)

    tier_expired = TicketTier(
        id='tier_expired_1',
        event_id=event.id,
        name='Early Bird VIP',
        price=20.0,
        quantity_available=50,
        quantity_sold=5,
        sale_end=datetime.utcnow() - timedelta(hours=2)
    )
    test_db.add(tier_expired)
    test_db.commit()

    res = client.post('/api/ticketing/checkout/create-payment-intent', json={
        'event_id': event.id,
        'buyer_name': 'Bob Smith',
        'buyer_email': 'bob@example.com',
        'items': [{'tier_id': tier_expired.id, 'quantity': 1}]
    })
    assert res.status_code == 400
    assert 'Sales for Early Bird VIP have ended' in res.json()['detail']

def test_automated_ticket_sales_cutoff_fallback_to_event_date_start(client: TestClient, test_db: Session):
    user = User(
        id='user_seller_cutoff_2',
        email='seller_cutoff2@example.com',
        username='seller_cutoff2',
        seller_tier=2,
        seller_status='approved'
    )
    test_db.add(user)

    org = Organizer(
        id='org_profile_cutoff_2',
        user_id=user.id,
        name='Highland Arts',
        slug='highland-arts'
    )
    test_db.add(org)

    stripe_acc = OrganizerStripeAccount(
        id='stripe_acc_cutoff_2',
        organizer_profile_id=org.id,
        stripe_account_id='acct_mock_cutoff_2',
        charges_enabled=True,
        payouts_enabled=True,
        details_submitted=True
    )
    test_db.add(stripe_acc)

    event_passed = Event(
        id='evt_passed_1',
        title='Yesterday Concert',
        slug='yesterday-concert',
        date_start=datetime.utcnow() - timedelta(days=1),
        date_end=datetime.utcnow() - timedelta(days=1, hours=-3),
        organizer_id=user.id,
        organizer_profile_id=org.id,
        is_ticketing_enabled=True
    )
    test_db.add(event_passed)

    tier_no_sale_end = TicketTier(
        id='tier_passed_event_1',
        event_id=event_passed.id,
        name='General Admission',
        price=15.0,
        quantity_available=100,
        quantity_sold=10,
        sale_end=None
    )
    test_db.add(tier_no_sale_end)
    test_db.commit()

    res = client.post('/api/ticketing/checkout/create-payment-intent', json={
        'event_id': event_passed.id,
        'buyer_name': 'Jane Doe',
        'buyer_email': 'jane@example.com',
        'items': [{'tier_id': tier_no_sale_end.id, 'quantity': 2}]
    })
    assert res.status_code == 400
    assert 'Sales for General Admission have ended' in res.json()['detail']

def test_anti_overselling_validation(client: TestClient, test_db: Session):
    user = User(
        id='user_oversell_1',
        email='oversell@example.com',
        username='oversell',
        seller_tier=2,
        seller_status='approved'
    )
    test_db.add(user)

    org = Organizer(
        id='org_profile_oversell_1',
        user_id=user.id,
        name='Loch Ness Club',
        slug='loch-ness-club'
    )
    test_db.add(org)

    stripe_acc = OrganizerStripeAccount(
        id='stripe_acc_oversell_1',
        organizer_profile_id=org.id,
        stripe_account_id='acct_mock_oversell_1',
        charges_enabled=True,
        payouts_enabled=True,
        details_submitted=True
    )
    test_db.add(stripe_acc)

    event = Event(
        id='evt_oversell_1',
        title='Limited Space Workshop',
        slug='limited-space-workshop',
        date_start=datetime.utcnow() + timedelta(days=10),
        date_end=datetime.utcnow() + timedelta(days=10, hours=2),
        organizer_id=user.id,
        organizer_profile_id=org.id,
        is_ticketing_enabled=True
    )
    test_db.add(event)

    tier = TicketTier(
        id='tier_oversell_1',
        event_id=event.id,
        name='Exclusive Pass',
        price=0.0,
        quantity_available=10,
        quantity_sold=9,
        max_per_order=6
    )
    test_db.add(tier)
    test_db.commit()

    res = client.post('/api/ticketing/checkout/create-payment-intent', json={
        'event_id': event.id,
        'buyer_name': 'Over Buyer',
        'buyer_email': 'over@example.com',
        'items': [{'tier_id': tier.id, 'quantity': 2}]
    })
    assert res.status_code == 400
    assert 'Not enough tickets available for Exclusive Pass' in res.json()['detail']

    res_ok = client.post('/api/ticketing/checkout/create-payment-intent', json={
        'event_id': event.id,
        'buyer_name': 'Exact Buyer',
        'buyer_email': 'exact@example.com',
        'items': [{'tier_id': tier.id, 'quantity': 1}]
    })
    assert res_ok.status_code == 200
    assert res_ok.json()['free_order'] is True

    res_sold_out = client.post('/api/ticketing/checkout/create-payment-intent', json={
        'event_id': event.id,
        'buyer_name': 'Late Buyer',
        'buyer_email': 'late@example.com',
        'items': [{'tier_id': tier.id, 'quantity': 1}]
    })
    assert res_sold_out.status_code == 400
    assert 'Not enough tickets available for Exclusive Pass' in res_sold_out.json()['detail']

def test_admin_order_search_and_email_typo_fixer(client: TestClient, test_db: Session):
    admin_user = User(
        id='admin_user_1',
        email='admin@heh.com',
        username='admin',
        is_admin=True
    )
    test_db.add(admin_user)

    event = Event(
        id='evt_admin_support_1',
        title='Ceilidh at the Barn',
        date_start=datetime.utcnow() + timedelta(days=2),
        date_end=datetime.utcnow() + timedelta(days=2, hours=4),
        organizer_id=admin_user.id,
        is_ticketing_enabled=True
    )
    test_db.add(event)

    tier = TicketTier(
        id='tier_admin_support_1',
        event_id=event.id,
        name='General',
        price=12.0,
        quantity_available=50,
        quantity_sold=1
    )
    test_db.add(tier)

    order = Order(
        id='ord_typo_1',
        order_ref='HEH-TYPO99',
        event_id=event.id,
        buyer_name='Gregor MacLeod',
        buyer_email='gregor.typo@gmailll.com',
        total_amount=12.0,
        stripe_payment_intent_id='pi_test_card_4242',
        status='completed'
    )
    test_db.add(order)

    ticket = Ticket(
        id='tkt_typo_1',
        order_id=order.id,
        tier_id=tier.id,
        qr_token='QR-SECURE-TOKEN-123',
        status='valid'
    )
    test_db.add(ticket)
    test_db.commit()

    def get_admin_override():
        return admin_user
    app.dependency_overrides[get_current_user] = get_admin_override

    # 1. Search by buyer name
    res_name = client.get('/api/admin/ticketing/orders/search?q=Gregor')
    assert res_name.status_code == 200
    assert len(res_name.json()['results']) == 1

    # 2. Search by order_ref
    res_ref = client.get('/api/admin/ticketing/orders/search?q=TYPO99')
    assert res_ref.status_code == 200
    assert len(res_ref.json()['results']) == 1

    # 3. Search by payment method last4 / intent id
    res_pi = client.get('/api/admin/ticketing/orders/search?q=4242')
    assert res_pi.status_code == 200
    assert len(res_pi.json()['results']) == 1

    # 4. Update buyer email and re-dispatch tickets
    res_update = client.put(f'/api/admin/ticketing/orders/{order.id}/update-email', json={
        'new_email': 'gregor.correct@gmail.com'
    })
    assert res_update.status_code == 200
    data = res_update.json()
    assert data['status'] == 'success'
    assert data['new_email'] == 'gregor.correct@gmail.com'
    assert data['old_email'] == 'gregor.typo@gmailll.com'
    assert data['email_dispatched'] is True

    # Verify updated in DB
    refreshed_order = test_db.get(Order, order.id)
    assert refreshed_order.buyer_email == 'gregor.correct@gmail.com'


def test_native_ticketing_single_session_and_duration_validation(client: TestClient, test_db: Session):
    admin_user = User(
        id=normalize_uuid(str(uuid4())),
        email='admin_limits@heh.com',
        username='admin_limits',
        is_admin=True
    )
    test_db.add(admin_user)

    cat = Category(
        id=normalize_uuid(str(uuid4())),
        name='Live Music',
        slug='live-music'
    )
    test_db.add(cat)
    test_db.commit()

    def get_admin_override():
        return admin_user

    app.dependency_overrides[get_current_user] = get_admin_override
    app.dependency_overrides[core_get_current_user] = get_admin_override

    start_time = (datetime.utcnow() + timedelta(days=7)).replace(hour=20, minute=0, second=0, microsecond=0)

    # 1. Valid Ticketed Event (Overnight gig: 8:00 PM to 2:00 AM next day -> 6 hours)
    valid_payload = {
        'title': 'Overnight Acoustic Session',
        'category_id': cat.id,
        'location_name': 'Strathpeffer Pavilion',
        'date_start': start_time.isoformat(),
        'date_end': (start_time + timedelta(hours=6)).isoformat(),
        'is_ticketing_enabled': True,
        'terms_accepted': True,
        'ticket_tiers': [
            {'name': 'General Admission', 'price': 15.0, 'quantity_available': 50, 'max_per_order': 6}
        ]
    }
    res_valid = client.post('/api/events', json=valid_payload)
    assert res_valid.status_code == 201
    created_id = res_valid.json()['id']
    assert res_valid.json()['is_ticketing_enabled'] is True

    # 2. Invalid Ticketed Event: Duration > 36 hours (e.g. 48 hours) -> 400
    invalid_duration_payload = {
        'title': 'Weekend Multi-Day Festival',
        'category_id': cat.id,
        'location_name': 'Strathpeffer Pavilion',
        'date_start': start_time.isoformat(),
        'date_end': (start_time + timedelta(hours=48)).isoformat(),
        'is_ticketing_enabled': True,
        'terms_accepted': True,
        'ticket_tiers': [
            {'name': 'Weekend Pass', 'price': 80.0, 'quantity_available': 100, 'max_per_order': 4}
        ]
    }
    res_invalid_dur = client.post('/api/events', json=invalid_duration_payload)
    assert res_invalid_dur.status_code == 400
    assert 'Native ticketing is currently restricted to single-session events up to 36 hours.' in res_invalid_dur.json()['detail']

    # 3. Invalid Ticketed Event: Recurring Event -> 400
    invalid_recurring_payload = {
        'title': 'Weekly Highland Ceilidh Class',
        'category_id': cat.id,
        'location_name': 'Strathpeffer Pavilion',
        'date_start': start_time.isoformat(),
        'date_end': (start_time + timedelta(hours=2)).isoformat(),
        'is_ticketing_enabled': True,
        'terms_accepted': True,
        'is_recurring': True,
        'frequency': 'WEEKLY',
        'ticket_tiers': [
            {'name': 'Class Entry', 'price': 10.0, 'quantity_available': 30, 'max_per_order': 2}
        ]
    }
    res_invalid_rec = client.post('/api/events', json=invalid_recurring_payload)
    assert res_invalid_rec.status_code == 400
    assert 'Native ticketing is currently restricted to single-session events up to 36 hours.' in res_invalid_rec.json()['detail']

    # 4. Invalid Update: Updating valid ticketed event to > 36 hours -> 400
    res_update_dur = client.put(f'/api/events/{created_id}', json={
        'date_end': (start_time + timedelta(hours=40)).isoformat()
    })
    assert res_update_dur.status_code == 400
    assert 'Native ticketing is currently restricted to single-session events up to 36 hours.' in res_update_dur.json()['detail']

    # 5. Invalid Update: Updating valid ticketed event to recurring -> 400
    res_update_rec = client.put(f'/api/events/{created_id}', json={
        'is_recurring': True,
        'frequency': 'WEEKLY'
    })
    assert res_update_rec.status_code == 400
    assert 'Native ticketing is currently restricted to single-session events up to 36 hours.' in res_update_rec.json()['detail']

