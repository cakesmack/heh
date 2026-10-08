from datetime import datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects import postgresql
from sqlmodel import SQLModel, Session, create_engine, select

from app.core.database import get_session
from app.core.occurrences import occurrence_filter, relevant_dates
from app.core.security import get_current_user
from app.api.admin import require_admin
from app.main import app
from app.models.event import Event
from app.models.showtime import EventShowtime
from app.models.user import User
from app.models.category import Category
from app.models.collection import Collection
from app.models.featured_booking import FeaturedBooking, SlotType, BookingStatus


NOW = datetime(2026, 5, 14, 12)


@pytest.fixture
def discovery(monkeypatch):
    monkeypatch.setattr('app.core.occurrences.event_now', lambda: NOW)
    for module in ['events', 'recommendations', 'search', 'locations']:
        monkeypatch.setattr(f'app.api.{module}.event_now', lambda: NOW)
    engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        user = User(id=uuid4().hex, email='occurrences@example.org', username='occurrences', is_admin=True)
        category = Category(id=uuid4().hex, name='Music', slug='music')
        session.add_all([user, category])
        def event(title, day, **kwargs):
            row = Event(id=uuid4().hex, title=title, organizer_id=user.id, category_id=category.id,
                        status='published', location_name='Inverness', latitude=57.48, longitude=-4.22,
                        date_start=datetime(2026, 5, day, 10), date_end=datetime(2026, 5, day, 13), **kwargs)
            session.add(row)
            return row
        group = uuid4().hex
        parent = event('Series', 7, is_recurring=True, recurrence_group_id=group)
        children = [event('Series', day, is_recurring=True, recurrence_group_id=group, parent_event_id=parent.id) for day in [14, 21, 28]]
        multi = event('Multiple', 7)
        ended = event('Ended', 7)
        all_day = event('All day', 14, is_all_day=True)
        all_day.date_end = datetime(2026, 5, 14)
        session.flush()
        for row, days in [(multi, [7, 14, 21]), (ended, [6, 7])]:
            for day in days:
                session.add(EventShowtime(event_id=row.id, start_time=datetime(2026, 5, day, 10), end_time=datetime(2026, 5, day, 13)))
        session.commit()
        app.dependency_overrides[get_session] = lambda: session
        app.dependency_overrides[require_admin] = lambda: user
        app.dependency_overrides[get_current_user] = lambda: user
        try:
            yield TestClient(app), session, parent, children, multi, ended
        finally:
            app.dependency_overrides.clear()
    engine.dispose()


def rows(response, key='events'):
    assert response.status_code == 200, response.text
    body = response.json()
    return body if isinstance(body, list) else body[key]


def test_default_discovery_uses_current_or_next_actual_occurrence(discovery):
    client, session, parent, children, multi, ended = discovery
    result = rows(client.get('/api/events'))
    assert {r['title'] for r in result} == {'Series', 'Multiple', 'All day'}
    assert next(r for r in result if r['title'] == 'Series')['id'].replace('-', '') == children[0].id
    assert next(r for r in result if r['title'] == 'Multiple')['date_start'].startswith('2026-05-14T10:00')
    assert session.get(Event, ended.id).status == 'published'
    assert len(multi.showtimes) == 3


@pytest.mark.parametrize('route', ['/api/events', '/api/events/map', '/api/map/events'])
@pytest.mark.parametrize('day', [7, 14, 21])
def test_date_window_keeps_matching_series_row_and_display_date(discovery, route, day):
    client, _, parent, children, _, _ = discovery
    params = {'date_from': f'2026-05-{day:02d}T00:00:00', 'date_to': f'2026-05-{day:02d}T23:59:59', 'include_past': True}
    result = rows(client.get(route, params=params))
    series = [row for row in result if row['title'] == 'Series']
    assert len(series) == 1
    expected = parent if day == 7 else children[0 if day == 14 else 1]
    assert series[0]['id'].replace('-', '') == expected.id
    assert series[0]['date_start'].startswith(f'2026-05-{day:02d}T10:00')


def test_no_envelope_or_unrelated_dates_leak_into_window(discovery):
    client, _, _, _, _, _ = discovery
    assert rows(client.get('/api/events', params={'date_from': '2026-05-16T00:00:00', 'date_to': '2026-05-16T23:59:59', 'include_past': True})) == []
    assert rows(client.get('/api/events/map', params={'date_from': '2026-05-16', 'date_to': '2026-05-16'})) == []


def test_multi_date_future_only_and_all_ended_direct_access(discovery):
    client, session, _, _, multi, ended = discovery
    result = rows(client.get('/api/events', params={'date_from': '2026-05-15T00:00:00'}))
    assert next(row for row in result if row['title'] == 'Multiple')['date_start'].startswith('2026-05-21')
    assert 'Ended' not in {row['title'] for row in result}
    response = client.get(f'/api/events/{ended.id}')
    assert response.status_code == 200
    assert len(response.json()['showtimes']) == 2  # History remains available for editing.
    assert response.json()['date_end'].startswith('2026-05-07')
    assert not session.is_modified(multi)


def test_filtered_cards_only_receive_matching_showtimes(discovery):
    client, _, _, _, _, _ = discovery
    result = rows(client.get('/api/events', params={'date_from': '2026-05-21T00:00:00', 'date_to': '2026-05-21T23:59:59', 'include_past': True}))
    multiple = next(row for row in result if row['title'] == 'Multiple')
    assert [show['start_time'][:10] for show in multiple['showtimes']] == ['2026-05-21']


def test_collections_and_promoted_homepage_preserve_actual_dates(discovery):
    client, session, parent, _, multi, ended = discovery
    session.add(Collection(title='Dates', slug='dates', target_link='/events',
                           filter_params={'date_from': '2026-05-21', 'date_to': '2026-05-21'}))
    for event in [ended, parent, multi]:
        session.add(FeaturedBooking(event_id=event.id, slot_type=SlotType.PREMIUM, status=BookingStatus.ACTIVE,
                                    start_date=datetime(2020, 1, 1).date(), end_date=datetime(2035, 1, 1).date()))
    session.commit()
    result = rows(client.get('/api/collections/slug/dates/events'))
    assert {row['title'] for row in result} == {'Series', 'Multiple'}
    assert all(row['date_start'].startswith('2026-05-21') for row in result)
    result = rows(client.get('/api/events/promoted'))
    assert {row['title'] for row in result} == {'Series', 'Multiple'}
    assert all(row['date_start'].startswith('2026-05-14') for row in result)


def test_admin_past_option_exposes_historical_children(discovery):
    client, _, parent, children, _, ended = discovery
    default = rows(client.get('/api/admin/events'), key='data')
    assert parent.id in {row['id'] for row in default}
    assert ended.id not in {row['id'] for row in default}
    history = rows(client.get('/api/admin/events', params={'include_past': True}), key='data')
    assert {parent.id, ended.id, *(child.id for child in children)} <= {row['id'] for row in history}


def test_search_recommendations_and_location_use_same_public_rule(discovery):
    client, _, _, _, _, _ = discovery
    assert rows(client.get('/api/search', params={'q': 'Ended'})) == []
    result = rows(client.get('/api/recommendations', params={'limit': 10}))
    assert 'Ended' not in {row['title'] for row in result}
    assert next(row for row in result if row['title'] == 'Multiple')['date_start'].startswith('2026-05-14')
    result = rows(client.get('/api/locations/feed/inverness'))
    assert {row['title'] for row in result} == {'Series', 'Multiple', 'All day'}


def test_end_boundary_all_day_and_postgres_predicate(discovery):
    _, session, _, _, multi, _ = discovery
    assert relevant_dates(multi)[0] == datetime(2026, 5, 14, 10)
    assert session.exec(select(Event).where(occurrence_filter(datetime(2026, 5, 14, 13)))).all()
    result = session.exec(select(Event).where(occurrence_filter(datetime(2026, 5, 14, 23)))).all()
    assert 'All day' in {event.title for event in result}
    # Correlated EXISTS is valid for the production dialect, without migrations.
    sql = str(select(Event).where(occurrence_filter(NOW)).compile(dialect=postgresql.dialect()))
    assert 'EXISTS' in sql and 'event_showtimes' in sql
