"""PostgreSQL-only row-lock concurrency coverage for ticket reservations."""

import os
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url
from sqlmodel import SQLModel, Session, create_engine, func, select

from app.core.config import settings
from app.core.database import get_session
from app.main import app
from app.models import (
    Event,
    Order,
    Organizer,
    OrganizerStripeAccount,
    PromoCode,
    TicketReservation,
    TicketTier,
    User,
)


POSTGRES_URL = os.getenv("TEST_POSTGRES_URL")
pytestmark = pytest.mark.skipif(not POSTGRES_URL, reason="TEST_POSTGRES_URL is required")


@pytest.fixture(scope="module")
def pg_engine():
    assert POSTGRES_URL is not None
    url = make_url(POSTGRES_URL)
    assert url.get_backend_name() == "postgresql"
    assert url.host in {"127.0.0.1", "localhost"}
    assert url.database == "heh_concurrency_test"
    engine = create_engine(POSTGRES_URL, pool_size=10, max_overflow=10)
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def postgres_app(pg_engine, monkeypatch):
    monkeypatch.setattr(settings, "NATIVE_TICKET_SALES_ENABLED", True)

    def session_override():
        with Session(pg_engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    try:
        yield pg_engine
    finally:
        app.dependency_overrides.pop(get_session, None)


def seed_inventory(engine, prefix: str, capacities: tuple[int, ...] = (1,), *, promo=False):
    prefix = f"{prefix}_{uuid4().hex[:8]}"
    event_id = f"{prefix}_event"
    tier_ids = [f"{prefix}_tier_{index}" for index in range(len(capacities))]
    stripe_account_id = f"acct_{prefix}"
    scanner_token = f"{prefix}_scanner"
    with Session(engine) as session:
        user = User(
            id=f"{prefix}_user",
            email=f"{prefix}@example.com",
            username=f"{prefix}_user",
            seller_tier=2,
            seller_status="approved",
        )
        organizer = Organizer(
            id=f"{prefix}_organizer",
            user_id=user.id,
            name=f"{prefix} organizer",
            slug=f"{prefix}-organizer",
        )
        account = OrganizerStripeAccount(
            id=f"{prefix}_account",
            organizer_profile_id=organizer.id,
            stripe_account_id=stripe_account_id,
            charges_enabled=True,
            payouts_enabled=True,
        )
        event = Event(
            id=event_id,
            title=f"{prefix} event",
            slug=f"{prefix}-event",
            date_start=datetime.utcnow() + timedelta(days=5),
            date_end=datetime.utcnow() + timedelta(days=5, hours=2),
            organizer_id=user.id,
            organizer_profile_id=organizer.id,
            is_ticketing_enabled=True,
            scanner_access_key=scanner_token,
        )
        tiers = [
            TicketTier(
                id=tier_ids[index],
                event_id=event.id,
                name=f"Tier {index}",
                price=20.0,
                quantity_available=capacity,
                quantity_sold=0,
                max_per_order=4,
            )
            for index, capacity in enumerate(capacities)
        ]
        session.add(user)
        session.add(organizer)
        session.add(account)
        session.add(event)
        for tier in tiers:
            session.add(tier)
        if promo:
            session.add(PromoCode(
                id=f"{prefix}_promo",
                event_id=event.id,
                code_text="FREE100",
                discount_type="percentage",
                discount_value=100.0,
            ))
        session.commit()
    return event_id, tier_ids, stripe_account_id, scanner_token


def fake_intent(**kwargs):
    order_id = kwargs["metadata"]["ticket_order_id"]
    return SimpleNamespace(
        id=f"pi_{order_id}",
        client_secret=f"pi_{order_id}_secret",
        status="requires_payment_method",
    )


def checkout(event_id: str, tier_ids: list[str], attempt: str, promo_code=None):
    client = TestClient(app)
    try:
        return client.post(
            "/api/ticketing/checkout/create-payment-intent",
            json={
                "checkout_attempt_id": attempt,
                "event_id": event_id,
                "items": [{"tier_id": tier_id, "quantity": 1} for tier_id in tier_ids],
                "buyer_name": attempt,
                "buyer_email": f"{attempt}@example.com",
                "promo_code": promo_code,
            },
        )
    finally:
        client.close()


def committed(engine, tier_id: str) -> int:
    with Session(engine) as session:
        tier = session.get(TicketTier, tier_id)
        active = session.exec(
            select(func.coalesce(func.sum(TicketReservation.quantity), 0)).where(
                TicketReservation.tier_id == tier_id,
                TicketReservation.status == "active",
            )
        ).one()
        return tier.quantity_sold + int(active or 0)


def run_competitors(left, right):
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(left)
        second = executor.submit(right)
        return first.result(timeout=15), second.result(timeout=15)


def test_two_paid_buyers_cannot_reserve_the_last_ticket(postgres_app):
    event_id, tiers, _, _ = seed_inventory(postgres_app, "pg_paid")
    with patch("stripe.PaymentIntent.create", side_effect=fake_intent):
        responses = run_competitors(
            lambda: checkout(event_id, tiers, "pg-paid-attempt-one"),
            lambda: checkout(event_id, tiers, "pg-paid-attempt-two"),
        )
    assert sorted(response.status_code for response in responses) == [200, 400]
    assert committed(postgres_app, tiers[0]) == 1


def test_multi_tier_locking_is_atomic_and_deterministic(postgres_app):
    event_id, tiers, _, _ = seed_inventory(postgres_app, "pg_multi", (1, 1))
    with patch("stripe.PaymentIntent.create", side_effect=fake_intent):
        responses = run_competitors(
            lambda: checkout(event_id, tiers, "pg-multi-attempt-one"),
            lambda: checkout(event_id, list(reversed(tiers)), "pg-multi-attempt-two"),
        )
    assert sorted(response.status_code for response in responses) == [200, 400]
    assert [committed(postgres_app, tier_id) for tier_id in tiers] == [1, 1]


def test_paid_and_free_checkout_compete_for_one_invariant(postgres_app):
    event_id, tiers, _, _ = seed_inventory(postgres_app, "pg_free", promo=True)
    with patch("stripe.PaymentIntent.create", side_effect=fake_intent):
        responses = run_competitors(
            lambda: checkout(event_id, tiers, "pg-paid-free-paid"),
            lambda: checkout(event_id, tiers, "pg-paid-free-free", promo_code="FREE100"),
        )
    assert sorted(response.status_code for response in responses) == [200, 400]
    assert committed(postgres_app, tiers[0]) == 1


def test_paid_and_cash_checkout_compete_for_one_invariant(postgres_app):
    event_id, tiers, _, scanner_token = seed_inventory(postgres_app, "pg_cash")

    def cash_purchase():
        client = TestClient(app)
        try:
            return client.post(
                "/api/ticketing/scan/cash-walk-up",
                json={
                    "event_id": event_id,
                    "token": scanner_token,
                    "tier_id": tiers[0],
                    "quantity": 1,
                },
            )
        finally:
            client.close()

    with patch("stripe.PaymentIntent.create", side_effect=fake_intent):
        responses = run_competitors(
            lambda: checkout(event_id, tiers, "pg-paid-cash-paid"),
            cash_purchase,
        )
    assert sorted(response.status_code for response in responses) == [200, 400]
    assert committed(postgres_app, tiers[0]) == 1
    with Session(postgres_app) as session:
        assert session.exec(select(func.count(Order.id)).where(Order.event_id == event_id)).one() == 1
