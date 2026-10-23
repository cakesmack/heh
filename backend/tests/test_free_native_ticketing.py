"""Focused real-handler coverage for free bookings and paid setup protection."""
import inspect
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException
from fastapi.params import Param
from sqlmodel import SQLModel, Session, create_engine, select
from starlette.requests import Request

import app.models
from app.api.checkout import CheckoutRequest, create_payment_intent, get_order
from app.api.events import create_event, update_event, create_event_ticket_tier, update_event_ticket_tier
from app.api.organizer_ticketing import get_organizer_dashboard, export_guest_list
from app.api.scanner import TicketValidationRequest, validate_ticket
from app.core.config import settings
from app.models import Event, Order, Organizer, OrganizerStripeAccount, Ticket, TicketReservation, TicketTier, User
from app.models.category import Category
from app.schemas.event import EventCreate, EventUpdate
from app.schemas.ticketing import TicketTierCreate, TicketTierUpdate
from app.services.stripe_service import dispatch_order_confirmation_emails


def call(handler, **overrides):
    """Avoid HTTP lifespan/socket setup; run actual handlers with isolated sessions."""
    handler = inspect.unwrap(handler)
    values = {key: p.default.default if isinstance(p.default, Param) else p.default
              for key, p in inspect.signature(handler).parameters.items()
              if p.default is not inspect.Parameter.empty}
    result = handler(**(values | overrides))
    if not inspect.isawaitable(result):
        return result
    try:
        result.send(None)
    except StopIteration as completed:
        return completed.value
    finally:
        result.close()
    pytest.fail('Unexpected asynchronous I/O in isolated route test')


@pytest.fixture
def data(monkeypatch):
    monkeypatch.setattr(settings, 'NATIVE_TICKET_SALES_ENABLED', True)
    monkeypatch.setattr(settings, 'STRIPE_SECRET_KEY', '')
    engine = create_engine('sqlite:///:memory:')
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        user = User(id=uuid4().hex, email='free-host@example.org', username='free_host',
                    is_trusted_organizer=True, trust_level=2)
        category = Category(id=uuid4().hex, name='Music', slug='music')
        session.add_all([user, category])
        session.commit()
        with patch('app.api.events.resend_email_service.send_event_approved', new_callable=AsyncMock), \
             patch('app.services.stripe_service.trigger_order_confirmation_emails') as confirmation, \
             patch('stripe.PaymentIntent.create', side_effect=AssertionError('No Stripe for free bookings')) as stripe_create:
            yield SimpleNamespace(session=session, user=user, category=category,
                                  confirmation=confirmation, stripe_create=stripe_create)
    engine.dispose()


def create(data, **extra):
    start = datetime.utcnow() + timedelta(days=14)
    payload = dict(title='Limited capacity ' + uuid4().hex, date_start=start,
                   date_end=start + timedelta(hours=2), category_id=data.category.id,
                   location_name='Inverness', terms_accepted=True, is_ticketing_enabled=True,
                   ticket_tiers=[dict(name='Reservation', price=0, quantity_available=2, max_per_order=2)])
    payload.update(extra)
    return call(create_event, request=Request({'type': 'http', 'method': 'POST', 'path': '/api/events', 'headers': []}),
                event_data=EventCreate(**payload), current_user=data.user, session=data.session,
                background_tasks=BackgroundTasks())


def edit(data, event_id, **extra):
    return call(update_event, event_id=event_id, event_data=EventUpdate(**extra),
                current_user=data.user, session=data.session, background_tasks=BackgroundTasks(), unlink_venue=False)


def checkout(data, event, quantity=2, attempt=None):
    return create_payment_intent(CheckoutRequest(checkout_attempt_id=attempt or uuid4().hex,
        event_id=str(event.id), buyer_email='visitor@example.org', buyer_name='Visitor',
        attendee_responses={'Access': 'Step free'},
        items=[dict(tier_id=event.ticket_tiers[0].id, quantity=quantity)]), data.session)


@pytest.mark.parametrize('pass_fees', [False, True])
def test_free_booking_without_stripe_reuses_fulfilment_capacity_and_management(data, pass_fees):
    response = create(data, pass_fees_to_buyer=pass_fees)
    event = data.session.get(Event, response.id.hex)
    event.scanner_access_key = 'scanner-test-only'
    data.session.commit()
    attempt = uuid4().hex
    result = checkout(data, event, attempt=attempt)
    assert result['free_order'] is True
    order = data.session.exec(select(Order)).one()
    assert order.status == 'completed'
    assert order.total_amount == order.subtotal_amount == order.platform_fee_amount == 0
    assert order.stripe_payment_intent_id is None and order.stripe_account_id is None
    tickets = data.session.exec(select(Ticket)).all()
    assert len(tickets) == 2 and all(t.status == 'valid' and t.qr_token for t in tickets)
    assert all(r.status == 'consumed' for r in data.session.exec(select(TicketReservation)).all())
    assert event.ticket_tiers[0].quantity_sold == 2
    data.confirmation.assert_called_once()
    assert checkout(data, event, attempt=attempt)['order_completed'] is True
    assert len(data.session.exec(select(Ticket)).all()) == 2
    data.confirmation.assert_called_once()
    with pytest.raises(HTTPException) as full:
        checkout(data, event, quantity=1)
    assert full.value.status_code == 400
    data.session.rollback()
    assert get_order(order.order_ref, data.session)['tickets'][0]['qr_token']
    dashboard = get_organizer_dashboard(event.id, data.user, data.session)
    assert dashboard['total_orders'] == 1 and dashboard['gross_revenue'] == 0
    assert b'visitor@example.org' in export_guest_list(event.id, data.user, data.session).body
    scanned = validate_ticket(TicketValidationRequest(event_id=event.id, token=event.scanner_access_key,
        qr_token=tickets[0].qr_token), data.session)
    assert scanned['status'] == 'valid'
    assert data.session.get(Ticket, tickets[0].id).status == 'checked_in'
    with patch('app.services.resend_email.resend_email_service.send_ticket_order_confirmation', new_callable=AsyncMock) as buyer, \
         patch('app.services.resend_email.resend_email_service.send_organizer_ticket_sale_notification', new_callable=AsyncMock) as host:
        assert call(dispatch_order_confirmation_emails, order_or_id=order, session=data.session)
        assert buyer.await_args.kwargs['total_amount'] == 0
        assert len(buyer.await_args.kwargs['ticket_summary'][0]['qr_tokens']) == 2
        assert host.await_args.kwargs['platform_fee'] == 0
    data.stripe_create.assert_not_called()


def ready_account(data):
    organizer = Organizer(id=uuid4().hex, name='Test host', slug=uuid4().hex, user_id=data.user.id)
    data.session.add(organizer)
    data.session.flush()
    account = OrganizerStripeAccount(organizer_profile_id=organizer.id, stripe_account_id='acct_test_ready',
                                    charges_enabled=True, payouts_enabled=True)
    data.session.add(account)
    data.session.commit()
    return account


def test_paid_setup_and_free_to_paid_edits_require_ready_stripe(data):
    paid = dict(name='Paid', price=12, quantity_available=10, max_per_order=2)
    with pytest.raises(HTTPException, match='Connect Stripe'):
        create(data, ticket_tiers=[paid])
    data.session.rollback()
    response = create(data)
    event_id = response.id.hex
    tier_id = response.ticket_tiers[0].id
    with pytest.raises(HTTPException, match='Connect Stripe'):
        edit(data, event_id, ticket_tiers=[dict(paid, id=tier_id)])
    data.session.rollback()
    assert data.session.get(TicketTier, tier_id).price == 0
    with pytest.raises(HTTPException, match='Connect Stripe'):
        create_event_ticket_tier(event_id, TicketTierCreate(**paid), data.user, data.session)
    data.session.rollback()
    with pytest.raises(HTTPException, match='Connect Stripe'):
        update_event_ticket_tier(event_id, tier_id, TicketTierUpdate(price=12), data.user, data.session)
    data.session.rollback()
    ready_account(data)
    assert edit(data, event_id, ticket_tiers=[dict(paid, id=tier_id)]).ticket_tiers[0].price == 12
    assert create_event_ticket_tier(event_id, TicketTierCreate(**paid), data.user, data.session).price == 12
    assert update_event_ticket_tier(event_id, tier_id, TicketTierUpdate(price=15), data.user, data.session).price == 15
    assert create(data, ticket_tiers=[paid]).ticket_tiers[0].price == 12


def test_paid_checkout_retains_connect_routing_and_fees(data, monkeypatch):
    # Legacy/mutated positive tier must also fail closed at checkout itself.
    response = create(data)
    event = data.session.get(Event, response.id.hex)
    event.ticket_tiers[0].price = 12
    data.session.commit()
    with pytest.raises(HTTPException, match='Connect Stripe'):
        checkout(data, event, quantity=1)
    data.session.rollback()
    ready_account(data)
    monkeypatch.setattr(settings, 'STRIPE_SECRET_KEY', 'sk_test_not_live')
    with patch('stripe.PaymentIntent.create', return_value=SimpleNamespace(id='pi_test', client_secret='test_secret')) as intent:
        result = checkout(data, event, quantity=1)
    assert result['client_secret'] == 'test_secret'
    order = data.session.exec(select(Order)).one()
    assert order.status == 'pending_payment'
    assert order.total_amount > 0 and order.platform_fee_amount > 0
    assert intent.call_args.kwargs['amount'] == round(order.total_amount * 100)
    assert intent.call_args.kwargs['application_fee_amount'] == round(order.platform_fee_amount * 100)
    assert intent.call_args.kwargs['stripe_account'] == 'acct_test_ready'
    data.confirmation.assert_not_called()


@pytest.mark.parametrize('price', ['£12', '£10 – £15', 'From £8', 'Free', 'Check booking site'])
def test_external_booking_price_and_url_roundtrip(data, price):
    response = create(data, is_ticketing_enabled=False, ticket_tiers=[], price=price,
                      ticket_url='https://example.org/booking')
    assert response.price_display == price
    assert response.ticket_url == 'https://example.org/booking'
    updated = edit(data, response.id.hex, price=price, ticket_url='https://example.org/new')
    assert updated.price_display == price and updated.ticket_url == 'https://example.org/new'


def test_free_tickets_preserve_native_safety_gate(data, monkeypatch):
    response = create(data)
    event = data.session.get(Event, response.id.hex)
    monkeypatch.setattr(settings, 'NATIVE_TICKET_SALES_ENABLED', False)
    with pytest.raises(HTTPException) as blocked:
        checkout(data, event)
    assert blocked.value.status_code == 503
    with pytest.raises(HTTPException) as blocked_setup:
        create(data)
    assert blocked_setup.value.status_code == 503
