from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401
from app.api.admin import require_admin
from app.api.admin_roundups import roundup_candidates, router
from app.models.event import Event
from app.models.location import Location
from app.models.user import User
from app.models.venue import Venue
from app.services.event_roundups import popularity_score, shortlist_query

START = datetime(2026, 10, 19)
END = datetime(2026, 10, 26)


@pytest.fixture
def session():
    engine = create_engine('sqlite:///:memory:')
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def event(session, **changes):
    row = Event(id=uuid4().hex, title='Roundup event ' + uuid4().hex, date_start=START + timedelta(hours=10),
                date_end=START + timedelta(hours=12), status='published', **changes)
    session.add(row)
    session.flush()
    return row


def venue(session, city='Fort William'):
    row = Venue(id=uuid4().hex, name='Venue', address='Street', city=city, latitude=57, longitude=-4)
    session.add(row)
    session.flush()
    return row


def test_score_and_null_defaults():
    assert popularity_score(10, 3, 2) == 29
    assert popularity_score(None, None, None) == 0
    sql = str(shortlist_query(START, END).compile(dialect=postgresql.dialect()))
    assert 'coalesce' in sql.lower() and 'row_number() OVER' in sql


def test_highest_per_venue_and_distinct_venue_less_candidates(session):
    hall = venue(session)
    weaker = event(session, venue_id=hall.id, view_count=50)
    winner = event(session, venue_id=hall.id, website_click_count=20)
    hidden = event(session, venue_id=hall.id, view_count=10000)
    hidden.status = 'rejected'
    event(session, venue_id=hall.id, view_count=20000, is_cancelled=True)
    session.flush()
    standalone = [event(session, view_count=45), event(session, ticket_click_count=8)]
    rows = session.exec(shortlist_query(START, END)).all()
    assert [row.id for row in rows] == [winner.id, *[row.id for row in standalone]]
    assert weaker.id not in {row.id for row in rows}


@pytest.mark.parametrize('status', ['draft', 'rejected', 'pending', 'pending_review', 'archived'])
def test_non_public_states_are_excluded(session, status):
    row = event(session)
    row.status = status
    session.flush()
    assert session.exec(shortlist_query(START, END)).all() == []


def test_cancellation_and_exclusive_boundaries(session):
    cancelled = event(session, is_cancelled=True)
    before = event(session)
    before.date_start = START - timedelta(seconds=1)
    boundary = event(session)
    boundary.date_start = END
    valid = event(session)
    valid.date_start = START
    session.flush()
    assert [row.id for row in session.exec(shortlist_query(START, END)).all()] == [valid.id]


def test_top20_score_then_date_then_id_ordering(session):
    rows = [event(session, view_count=index) for index in range(25)]
    result = session.exec(shortlist_query(START, END)).all()
    assert [row.id for row in result] == [row.id for row in rows[:4:-1]]
    rows[0].view_count = 30
    rows[1].view_count = 30
    rows[1].date_start += timedelta(hours=1)
    session.flush()
    assert [row.id for row in session.exec(shortlist_query(START, END)).all()][:2] == [rows[0].id, rows[1].id]


def test_location_uses_structured_city_including_participating_venues(session):
    local = venue(session, '  Fort William ')
    elsewhere = venue(session, 'Inverness')
    primary = event(session, venue_id=local.id)
    participating = event(session, venue_id=elsewhere.id)
    participating.participating_venues = [local]
    remote = event(session)
    remote.location_name = 'Fort William somewhere'  # Not trusted structured city.
    session.flush()
    assert {row.id for row in session.exec(shortlist_query(START, END, 'Fort William')).all()} == {primary.id, participating.id}


def test_api_missing_optional_data_and_location_contract(session):
    row = event(session)
    admin = User(id=uuid4().hex, email='roundup@example.org', username='roundup', is_admin=True)
    response = roundup_candidates(START, END, None, admin, session)
    candidate = response.candidates[0]
    assert candidate.id == row.id and candidate.category_color is None and candidate.image_url is None
    assert candidate.venue_name is None and candidate.popularity_score == 0
    with pytest.raises(HTTPException) as invalid:
        roundup_candidates(START, START, None, admin, session)
    assert invalid.value.status_code == 422
    with pytest.raises(HTTPException) as missing:
        roundup_candidates(START, END, 999, admin, session)
    assert missing.value.status_code == 404
    hub = Location(name='Fort William', slug='fort-william')
    session.add(hub)
    session.flush()
    assert roundup_candidates(START, END, hub.id, admin, session).location_name == 'Fort William'


def test_admin_dependency_is_required():
    endpoint = next(route for route in router.routes if route.path == '/roundups/candidates')
    assert any(dependency.call is require_admin for dependency in endpoint.dependant.dependencies)
    with pytest.raises(HTTPException) as error:
        require_admin(User(email='viewer@example.org', username='viewer', is_admin=False))
    assert error.value.status_code == 403


def test_endpoint_is_registered_in_existing_application():
    from app.main import app
    assert any(getattr(route, 'path', None) == '/api/admin/roundups/candidates' for route in app.routes)
