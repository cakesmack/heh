from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

from app.api.auth import get_current_user
from app.core.database import get_session
from app.main import app
from app.models.category import Category
from app.models.event import Event
from app.models.user import User
from app.models.venue import Venue
from app.services.resend_email import resend_email_service


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.mark.parametrize(
    ("frequency", "last_date", "expected_dates", "expected_rule"),
    [
        ("WEEKLY", "2026-10-16", ["2026-10-07", "2026-10-12", "2026-10-14"], "FREQ=WEEKLY;BYDAY=MO,WE"),
        ("BIWEEKLY", "2026-10-30", ["2026-10-07", "2026-10-19", "2026-10-21"], "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"),
    ],
)
def test_create_recurring_event_honours_selected_weekdays(frequency, last_date, expected_dates, expected_rule):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        user = User(id=uuid4().hex, email=f"host-{frequency.lower()}@example.com", username=f"host_{frequency.lower()}")
        category = Category(id=uuid4().hex, name="Community", slug=f"community-{frequency.lower()}")
        venue = Venue(id=uuid4().hex, name="Highland Hall", address="Main Street", city="Inverness", postcode="IV1 1AA", latitude=57.47, longitude=-4.22)
        session.add(user)
        session.add(category)
        session.add(venue)
        session.commit()

        app.dependency_overrides[get_session] = lambda: session
        app.dependency_overrides[get_current_user] = lambda: user
        payload = {
            "title": f"Weekday series {frequency}",
            "date_start": "2026-10-05T09:00:00Z",
            "date_end": "2026-10-05T11:00:00Z",
            "category_id": category.id,
            "venue_id": venue.id,
            "price": "Free",
            "is_recurring": True,
            "frequency": frequency,
            "weekdays": [2, 0, 2],
            "recurrence_end_date": f"{last_date}T23:59:59Z",
        }
        try:
            with patch.object(resend_email_service, "send_new_event_notification", AsyncMock(return_value=True)), patch.object(resend_email_service, "send_event_approved", AsyncMock(return_value=True)):
                response = TestClient(app).post("/api/events", json=payload)
            assert response.status_code == 201, response.text
            parent = session.exec(select(Event).where(Event.title == payload["title"], Event.parent_event_id == None)).one()
            assert parent.recurrence_rule.startswith(expected_rule)
            children = session.exec(select(Event).where(Event.parent_event_id == parent.id)).all()
            assert sorted(child.date_start.date().isoformat() for child in children) == expected_dates
            assert all(child.recurrence_group_id == parent.recurrence_group_id for child in children)
        finally:
            app.dependency_overrides.clear()
