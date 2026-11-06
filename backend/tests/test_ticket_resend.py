from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter

from app.api import admin_ticketing, organizer_ticketing, buyer_ticketing, checkout
from app.core.config import settings
from app.models.event import Event
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.ticket_tier import TicketTier
from app.models.ticket_reservation import TicketReservation
from app.models.user import User
from app.models.organizer import Organizer
from app.services import ticket_resend, resend_email
from app.services.email_service import SmartEmailService


def run(coroutine):
    with pytest.raises(StopIteration) as completed:
        coroutine.send(None)
    return completed.value.value


@pytest.fixture
def sale(monkeypatch, mock_all_email_dispatches):
    owner = User(id="owner", email="owner@example.com", username="owner")
    event = Event(id="event", title="Existing event", organizer_id=owner.id,
                  date_start=datetime(2026, 12, 1, 12), location_name="Inverness", address_full="Inverness")
    tier = TicketTier(id="tier", event_id=event.id, name="Standard", price=20, quantity_available=50, quantity_sold=2)
    order = Order(id="order", order_ref="HEH-TEST", event_id=event.id, buyer_user_id="buyer",
                  buyer_email="historic@example.com", buyer_name="Buyer", status="completed",
                  total_amount=40, platform_fee_amount=3, stripe_payment_intent_id="pi_existing")
    tickets = [Ticket(id="first", order_id=order.id, tier_id=tier.id, qr_token="existing-qr-first"),
               Ticket(id="second", order_id=order.id, tier_id=tier.id, qr_token="existing-qr-second",
                      status="checked_in", checked_in_at=datetime(2026, 12, 1, 12), checked_in_by="scanner")]
    reservation = TicketReservation(order_id=order.id, tier_id=tier.id, quantity=2, unit_price=20, status="consumed")
    order.event = event
    order.tickets = tickets
    for ticket in tickets:
        ticket.tier = tier
    objects = [owner, event, tier, order, *tickets, reservation]
    lookup = {(type(obj), obj.id): obj for obj in objects}
    session = Mock()
    session.get.side_effect = lambda model, key: lookup.get((model, key))
    session.exec.return_value.first.return_value = event
    session.exec.return_value.all.return_value = tickets
    storage = MemoryStorage()
    monkeypatch.setattr(ticket_resend, "limiter", SimpleNamespace(limiter=FixedWindowRateLimiter(storage)))
    service = resend_email.ResendEmailService()
    service.send_ticket_order_confirmation = AsyncMock(wraps=service.send_ticket_order_confirmation)
    monkeypatch.setattr(ticket_resend, "resend_email_service", service)
    monkeypatch.setattr(resend_email, "smart_email_service", SmartEmailService())
    for name, value in {
        "TRANSACTIONAL_SMTP_HOST": "email-smtp.eu-north-1.amazonaws.com",
        "TRANSACTIONAL_SMTP_USER": "test-user", "TRANSACTIONAL_SMTP_PASS": "test-password",
        "TRANSACTIONAL_FROM_ADDRESS": "Highland Events Hub <noreply@highlandeventshub.co.uk>",
        "FRONTEND_URL": "https://highlandeventshub.co.uk",
    }.items():
        monkeypatch.setattr(settings, name, value)
    original = [obj.model_dump() for obj in objects]
    yield SimpleNamespace(owner=owner, event=event, tier=tier, order=order, tickets=tickets,
                          session=session, service=service, smtp=mock_all_email_dispatches["smtp_sdk"], storage=storage)
    assert [obj.model_dump() for obj in objects] == original
    for method in (session.add, session.add_all, session.commit, session.flush, session.delete):
        method.assert_not_called()
    storage.timer.cancel()


def test_organizer_resends_same_tickets_via_ses_without_sale_side_effects(sale, caplog):
    caplog.set_level("INFO", logger=ticket_resend.logger.name)
    result = run(organizer_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))
    assert result == {"status": "success", "message": "Tickets resent to h***@example.com"}
    args = sale.service.send_ticket_order_confirmation.call_args.kwargs
    assert args["to_email"] == sale.order.buyer_email
    assert args["order_ref"] == sale.order.order_ref
    assert args["ticket_summary"] == [{"name": "Standard", "qty": 2, "price": 20,
                                        "qr_tokens": ["existing-qr-first", "existing-qr-second"]}]
    sale.smtp.assert_awaited_once()
    message = sale.smtp.call_args.args[0]
    assert message["To"] == sale.order.buyer_email
    assert message["From"] == "Highland Events Hub <noreply@highlandeventshub.co.uk>"
    assert "/orders/HEH-TEST" in message.get_content()
    assert sale.smtp.call_args.kwargs["hostname"] == "email-smtp.eu-north-1.amazonaws.com"
    assert "order_id=order actor_id=owner role=organizer outcome=success timestamp=" in caplog.text
    assert "existing-qr" not in caplog.text and sale.order.buyer_email not in caplog.text


def test_unrelated_organizer_cannot_resend(sale):
    other = User(id="other", email="other@example.com", username="other")
    with pytest.raises(HTTPException) as error:
        run(organizer_ticketing.resend_order_tickets(sale.order.id, other, sale.session))
    assert error.value.status_code == 403
    sale.smtp.assert_not_awaited()


def test_slug_collision_cannot_authorize_another_events_order(sale):
    other_event = Event(id="other-event", slug=sale.order.event_id, title="Other event",
                        organizer_id=sale.owner.id, date_start=datetime(2026, 12, 1))
    sale.session.exec.return_value.first.return_value = other_event
    with pytest.raises(HTTPException) as error:
        run(organizer_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))
    assert error.value.status_code == 403
    sale.smtp.assert_not_awaited()


def test_simultaneous_resends_allow_only_one_delivery(sale):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    ready = Barrier(8)
    def attempt(_):
        ready.wait(timeout=5)
        try:
            run(organizer_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))
            return 200
        except HTTPException as error:
            return error.status_code
    with ThreadPoolExecutor(max_workers=8) as workers:
        statuses = list(workers.map(attempt, range(8)))
    assert statuses.count(200) == 1
    assert statuses.count(429) == 7
    sale.smtp.assert_awaited_once()


def test_admin_can_resend_and_non_admin_cannot_use_admin_route(sale):
    with pytest.raises(HTTPException) as error:
        run(admin_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))
    assert error.value.status_code == 403
    admin = User(id="admin", email="admin@example.com", username="admin", is_admin=True)
    assert run(admin_ticketing.resend_order_tickets(sale.order.id, admin, sale.session))["status"] == "success"
    sale.smtp.assert_awaited_once()


@pytest.mark.parametrize("management", ["profile", "venue", "suspended"])
def test_existing_organizer_management_permissions_are_reused(sale, management):
    from app.models.venue import Venue
    # Change only this test's event/actor setup; fixture snapshots are restored below.
    old_organizer_id = sale.event.organizer_id
    old_seller_status = sale.owner.seller_status
    try:
        sale.event.organizer_id = "another-submitter"
        if management == "profile":
            profile = Organizer(id="profile", name="Group", slug="group", user_id=sale.owner.id)
            sale.owner.organizer_profiles = [profile]
            sale.event.organizer_profile_id = profile.id
        elif management == "venue":
            sale.event.venue = Venue(name="Hall", address="High Street", latitude=57, longitude=-4, owner_id=sale.owner.id)
        else:
            sale.owner.seller_status = "frozen"
            with pytest.raises(HTTPException) as error:
                run(organizer_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))
            assert error.value.status_code == 403
            sale.smtp.assert_not_awaited()
            return
        assert run(organizer_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))["status"] == "success"
    finally:
        sale.event.organizer_id = old_organizer_id
        sale.event.organizer_profile_id = None
        sale.event.venue_id = None
        sale.event.venue = None
        sale.owner.seller_status = old_seller_status


@pytest.mark.parametrize("failure", [False, RuntimeError("private SMTP credentials")])
def test_delivery_failure_is_clear_and_does_not_mutate_order(sale, failure, caplog):
    caplog.set_level("INFO", logger=ticket_resend.logger.name)
    sale.service.send_ticket_order_confirmation.side_effect = failure if isinstance(failure, Exception) else None
    if failure is False:
        sale.service.send_ticket_order_confirmation.return_value = False
    with pytest.raises(HTTPException) as error:
        run(organizer_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))
    assert error.value.status_code == 502
    assert "Unable to send tickets" in error.value.detail
    assert "outcome=failure" in caplog.text
    assert "private SMTP credentials" not in caplog.text


def test_order_cooldown_shared_by_both_routes_and_allows_later_retry(sale, monkeypatch):
    run(organizer_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))
    admin = User(id="admin", email="admin@example.com", username="admin", is_admin=True)
    with pytest.raises(HTTPException) as error:
        run(admin_ticketing.resend_order_tickets(sale.order.id, admin, sale.session))
    assert error.value.status_code == 429
    assert error.value.headers["Retry-After"] == "60"
    sale.smtp.assert_awaited_once()
    expiry = sale.storage.get_expiry(ticket_resend.RESEND_LIMIT.key_for("ticket-resend", sale.order.id))
    monkeypatch.setattr("limits.storage.memory.time.time", lambda: expiry + 1)
    run(admin_ticketing.resend_order_tickets(sale.order.id, admin, sale.session))
    assert sale.smtp.await_count == 2


@pytest.mark.parametrize("kind", ["pending", "refunded", "cancelled", "no-tickets", "refunded-ticket", "missing-qr"])
def test_unfulfilled_or_invalid_orders_are_rejected(sale, kind):
    old_status = sale.order.status
    try:
        if kind in {"pending", "refunded"}:
            sale.order.status = kind
        elif kind == "cancelled":
            sale.event.is_cancelled = True
        elif kind == "no-tickets":
            sale.session.exec.return_value.all.return_value = []
        elif kind == "refunded-ticket":
            sale.tickets[0].status = "refunded"
        else:
            sale.tickets[0].qr_token = ""
        with pytest.raises(HTTPException) as error:
            run(organizer_ticketing.resend_order_tickets(sale.order.id, sale.owner, sale.session))
        assert error.value.status_code == 400
        sale.smtp.assert_not_awaited()
    finally:
        sale.order.status = old_status
        sale.event.is_cancelled = False
        sale.tickets[0].status = "valid"
        sale.tickets[0].qr_token = "existing-qr-first"


def test_buyer_account_and_existing_guest_order_link_keep_same_ticket_identities(sale):
    buyer = User(id="buyer", email=sale.order.buyer_email, username="buyer")
    sale.session.exec.return_value.all.side_effect = [[sale.order], [(t, sale.tier) for t in sale.tickets]]
    result = buyer_ticketing.get_my_orders(buyer, sale.session)
    assert [t["id"] for t in result["orders"][0]["tickets"]] == ["first", "second"]
    sale.session.exec.return_value.first.return_value = sale.order
    detail = checkout.get_order(sale.order.order_ref, sale.session)
    assert [(t["id"], t["qr_token"], t["status"]) for t in detail["tickets"]] == [
        ("first", "existing-qr-first", "valid"), ("second", "existing-qr-second", "checked_in")]
