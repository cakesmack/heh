from datetime import datetime, timedelta, timezone
import inspect
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql
from sqlmodel import Session, SQLModel, create_engine, select

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


def test_location_uses_public_fallbacks_including_participating_venues(session):
    local = venue(session, '  Fort William ')
    elsewhere = venue(session, 'Inverness')
    primary = event(session, venue_id=local.id)
    participating = event(session, venue_id=elsewhere.id)
    participating.participating_venues = [local]
    remote = event(session)
    remote.location_name = 'Fort William somewhere'  # Existing public event-location fallback.
    session.flush()
    assert {row.id for row in session.exec(shortlist_query(START, END, 'Fort William')).all()} == {primary.id, participating.id, remote.id}


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


@pytest.fixture
def november_inverness(session):
    user = User(id=uuid4().hex, email='november@example.org', username='november')
    hub = Location(name='Inverness', slug='inverness')
    session.add_all([user, hub])
    primary_venue = venue(session, None)
    primary_venue.address = 'High Street'
    primary_venue.formatted_address = 'High Street, Inverness, IV1 1AA'
    participating_venue = venue(session, None)
    participating_venue.address = 'Riverside, Inverness'
    outside_venue = venue(session, 'Elgin')
    last_venue = venue(session, None)
    last_venue.address = 'Inverness, IV2 3AA'
    primary = event(session, venue_id=primary_venue.id)
    participating = event(session, venue_id=outside_venue.id)
    participating.participating_venues = [participating_venue]
    outside = event(session, venue_id=outside_venue.id)
    last_day = event(session, venue_id=last_venue.id)
    excluded = event(session, venue_id=last_venue.id)
    no_venue = event(session)
    no_venue.location_name = 'Inverness city centre'
    draft = event(session, venue_id=primary_venue.id, view_count=100000)
    draft.status = 'draft'
    cancelled = event(session, venue_id=primary_venue.id, view_count=200000, is_cancelled=True)
    dates = [datetime(2026, 11, 1), datetime(2026, 11, 15, 10), datetime(2026, 11, 20, 10),
             datetime(2026, 11, 30, 23, 59, 59, 999999), datetime(2026, 12, 1),
             datetime(2026, 11, 25, 10), datetime(2026, 11, 10, 10), datetime(2026, 11, 12, 10)]
    for row, start in zip([primary, participating, outside, last_day, excluded, no_venue, draft, cancelled], dates):
        row.organizer_id = user.id
        row.date_start, row.date_end = start, start + timedelta(hours=2)
    session.commit()
    return hub, {row.id for row in [primary, participating, last_day, no_venue]}


def test_november_primary_participating_outside_and_exclusive_december_boundary(session, november_inverness):
    hub, expected = november_inverness
    admin = User(email='admin@example.org', username='admin', is_admin=True)
    response = roundup_candidates(datetime(2026, 11, 1, tzinfo=timezone.utc), datetime(2026, 12, 1, tzinfo=timezone.utc),
                                  hub.id, admin, session, diagnostics=True)
    assert {row.id for row in response.candidates} == expected
    assert response.start == datetime(2026, 11, 1) and response.end == datetime(2026, 12, 1)
    assert response.location_name == 'Inverness'
    assert response.diagnostics == {
        'events_in_date_range': 7, 'public_eligible_events': 5, 'primary_venue_matches': 2,
        'participating_venue_matches': 1, 'event_location_matches': 1, 'location_matches': 4,
        'legacy_exact_city_matches': 0,
    }
    assert roundup_candidates(datetime(2026, 11, 1), datetime(2026, 12, 1), hub.id, admin, session).diagnostics is None


def test_real_public_listing_and_poster_share_location_results(session, november_inverness):
    from fastapi.params import Param
    from starlette.requests import Request
    from app.api.events import list_events
    # Exercise the real handler without starting HTTP/application lifespan or a DB server.
    handler = inspect.unwrap(list_events)
    kwargs = {name: parameter.default.default if isinstance(parameter.default, Param) else parameter.default
              for name, parameter in inspect.signature(handler).parameters.items()
              if parameter.default is not inspect.Parameter.empty}
    kwargs.update(request=Request({'type': 'http', 'method': 'GET', 'path': '/api/events', 'headers': []}),
                  session=session, current_user=None, location='Inverness',
                  date_from=datetime(2026, 11, 1), date_to=datetime(2026, 11, 30, 23, 59, 59, 999999),
                  include_past=True, limit=100)
    response = handler(**kwargs)
    assert {row.id.hex for row in response.events} == november_inverness[1]


def test_shared_location_query_compiles_for_postgres_without_losing_outer_join():
    sql = str(shortlist_query(datetime(2026, 11, 1), datetime(2026, 12, 1), 'Inverness')
              .compile(dialect=postgresql.dialect()))
    assert 'LEFT OUTER JOIN venues' in sql and 'EXISTS' in sql
    assert 'venues.formatted_address' in sql and 'events.location_name' in sql


def test_location_allows_same_venue_top20_without_changing_scores(session):
    hall = venue(session, 'Inverness')
    rows = [event(session, venue_id=hall.id, view_count=index) for index in range(25)]
    assert [row.id for row in session.exec(shortlist_query(START, END, 'Inverness')).all()] == [row.id for row in rows[:4:-1]]
    assert [row.id for row in session.exec(shortlist_query(START, END)).all()] == [rows[-1].id]


def test_location_primary_and_multiple_participating_matches_return_one_event(session):
    halls = [venue(session, 'Inverness') for _ in range(3)]
    row = event(session, venue_id=halls[0].id)
    row.participating_venues = halls
    session.flush()
    hub = Location(name='Inverness', slug='inverness')
    session.add(hub)
    session.flush()
    response = roundup_candidates(START, END, hub.id, User(is_admin=True), session)
    assert [candidate.id for candidate in response.candidates] == [row.id]
    assert {v.id for v in response.candidates[0].venues} == {v.id for v in halls}
    assert len(response.candidates[0].venues) == 3


@pytest.mark.parametrize('location', [None, 'Inverness'])
@pytest.mark.parametrize('has_group', [False, True])
def test_recurring_identity_deduplicated_before_venue_and_top20(session, location, has_group):
    halls = [venue(session, 'Inverness') for _ in range(3)]
    group = uuid4().hex if has_group else None
    parent = event(session, venue_id=halls[0].id, is_recurring=True, recurrence_group_id=group, view_count=10)
    child = event(session, venue_id=halls[1].id, parent_event_id=parent.id,
                  recurrence_group_id=group, view_count=30)
    # Legacy child missing its group still shares the parent's identity.
    event(session, venue_id=halls[2].id, parent_event_id=parent.id, view_count=20)
    independent = event(session, venue_id=halls[2].id, view_count=5)
    assert [row.id for row in session.exec(shortlist_query(START, END, location)).all()] == [child.id, independent.id]


def test_identically_named_venues_are_distinct_in_weekly_mode(session):
    first, second = venue(session), venue(session)
    rows = [event(session, venue_id=first.id, view_count=2), event(session, venue_id=second.id, view_count=1)]
    assert [row.id for row in session.exec(shortlist_query(START, END)).all()] == [row.id for row in rows]
