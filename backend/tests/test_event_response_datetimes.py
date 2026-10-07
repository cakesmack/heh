from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.api.events import build_event_response
from app.core.database import get_session
from app.main import app
from app.models.category import Category
from app.models.event import Event
from app.models.user import User


NOW = datetime(2026, 10, 7, 12, tzinfo=timezone.utc)


class FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW.astimezone(tz) if tz else NOW.replace(tzinfo=None)

    @classmethod
    def utcnow(cls):
        return NOW.replace(tzinfo=None)


@pytest.fixture
def response_event():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    # Retain aware timestamp values just as PostgreSQL can return them; SQLite
    # otherwise strips offsets on reload and would mask this production bug.
    with Session(engine, expire_on_commit=False) as session:
        user = User(id=uuid4().hex, email="event-response@example.org", username="response_host")
        category = Category(id=uuid4().hex, name="Community", slug="community")
        event = Event(id=uuid4().hex, title="Highland response check", location_name="Inverness",
                      date_start=datetime(2027, 1, 7, 10), date_end=datetime(2027, 1, 7, 12),
                      organizer_id=user.id, category_id=category.id, status="published",
                      created_at=NOW - timedelta(days=2), view_count=100, attending_count=4,
                      ticket_click_count=1, website_click_count=2)
        session.add_all([user, category, event])
        session.commit()
        yield session, event
    engine.dispose()


@pytest.mark.parametrize("created_at", [
    datetime(2026, 10, 5, 12),
    datetime(2026, 10, 5, 12, tzinfo=timezone.utc),
    datetime(2026, 10, 5, 14, tzinfo=timezone(timedelta(hours=2))),
], ids=["naive-utc", "aware-utc", "aware-offset"])
def test_build_event_response_normalizes_arithmetic_without_mutating_timestamp(response_event, created_at):
    session, event = response_event
    # Mark the timestamp as loaded, not as a pending database update.
    from sqlalchemy.orm.attributes import set_committed_value
    set_committed_value(event, "created_at", created_at)
    with patch("app.api.events.datetime", FixedDatetime):
        response = build_event_response(event, session)
    assert response.popularity_score == 70.0
    assert response.created_at == created_at
    assert event.created_at is created_at
    assert not session.is_modified(event)
    assert response.model_dump(mode="json")["created_at"]


@pytest.mark.parametrize("query", ["", "?city_filter=Inverness"], ids=["standard-list", "city-list"])
def test_event_listing_serializes_production_style_aware_created_at(response_event, query):
    session, event = response_event
    original = event.created_at
    app.dependency_overrides[get_session] = lambda: session
    try:
        with patch("app.api.events.datetime", FixedDatetime):
            response = TestClient(app).get(f"/api/events{query}")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["total"] == 1
        assert data["events"][0]["title"] == event.title
        assert data["events"][0]["popularity_score"] == 70.0
        assert data["events"][0]["created_at"].endswith("Z")
        assert event.created_at is original
    finally:
        app.dependency_overrides.clear()


def test_event_detail_uses_same_safe_response_arithmetic(response_event):
    session, event = response_event
    app.dependency_overrides[get_session] = lambda: session
    try:
        with patch("app.api.events.datetime", FixedDatetime):
            response = TestClient(app).get(f"/api/events/{event.id}")
        assert response.status_code == 200, response.text
        assert response.json()["title"] == event.title
        assert response.json()["popularity_score"] >= 70.0
    finally:
        app.dependency_overrides.clear()
