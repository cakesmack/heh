from datetime import datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.core.database import get_session
from app.main import app
from app.models.category import Category
from app.models.collection import Collection
from app.models.event import Event
from app.models.user import User


@pytest.fixture
def map_client():
    engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        user = User(id=uuid4().hex, email='map-range@example.org', username='map_test')
        category = Category(id=uuid4().hex, name='Music', slug='music')
        other = Category(id=uuid4().hex, name='Other', slug='other')
        session.add_all([user, category, other])
        spans = {
            'before': ('2027-10-10T10:00', '2027-10-11T23:59'),
            'overlap-start': ('2027-10-10T10:00', '2027-10-13T12:00'),
            'inside': ('2027-10-12T10:00', '2027-10-12T12:00'),
            'overlap-end': ('2027-10-14T23:59:59.999999', '2027-10-16T12:00'),
            'spanning': ('2027-10-01T10:00', '2027-10-30T12:00'),
            'after': ('2027-10-15T00:00', '2027-10-15T12:00'),
            'other-category': ('2027-10-12T10:00', '2027-10-12T12:00'),
        }
        ids = {}
        for title, (start, end) in spans.items():
            ids[title] = uuid4().hex
            session.add(Event(id=ids[title], title=title, organizer_id=user.id,
                              category_id=other.id if title == 'other-category' else category.id,
                              date_start=datetime.fromisoformat(start), date_end=datetime.fromisoformat(end),
                              status='published', latitude=57.48, longitude=-4.22))
        session.add(Collection(title='Map collection', slug='map-collection', target_link='/events',
                               filter_params={'exclude_event_ids': [ids['inside']]}))
        session.commit()
        category_id = category.id
        app.dependency_overrides[get_session] = lambda: session
        try:
            # No lifespan: existing test safety blocks migrations/external services.
            yield TestClient(app), category_id
        finally:
            app.dependency_overrides.clear()
    engine.dispose()


def titles(response):
    assert response.status_code == 200, response.text
    return {event['title'] for event in response.json()}


@pytest.mark.parametrize('route', ['/api/events/map', '/api/map/events'])
def test_map_range_uses_full_calendar_days_and_overlap_on_both_routes(map_client, route):
    client, _ = map_client
    result = titles(client.get(route, params={'date_from': '2027-10-12', 'date_to': '2027-10-14'}))
    assert result == {'overlap-start', 'inside', 'overlap-end', 'spanning', 'other-category'}


def test_map_single_day_and_category_collection_combine(map_client):
    client, category_id = map_client
    params = {'date_from': '2027-10-12', 'date_to': '2027-10-12', 'category_id': category_id}
    assert titles(client.get('/api/events/map', params=params)) == {'overlap-start', 'inside', 'spanning'}
    params['collection_id'] = 'map-collection'
    assert titles(client.get('/api/events/map', params=params)) == {'overlap-start', 'spanning'}


def test_map_clear_restores_normal_upcoming_results(map_client):
    client, _ = map_client
    assert len(titles(client.get('/api/events/map'))) == 7
    assert titles(client.get('/api/events/map', params={'date_from': '2027-10-12'})) == {'overlap-start', 'inside', 'spanning', 'other-category'}


def test_map_timestamp_callers_keep_precision_and_convert_to_event_local_time(map_client):
    client, _ = map_client
    # October BST: these instants are 12:30–13:00 London-local, not 11:30–12:00.
    result = titles(client.get('/api/events/map', params={
        'date_from': '2027-10-12T11:30:00Z', 'date_to': '2027-10-12T12:00:00Z',
    }))
    # 12:30–13:00 locally: the 10:00–12:00 events have already finished.
    assert result == {'overlap-start', 'spanning'}
