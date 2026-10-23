"""Focused category API/query and migration coverage; no external services."""
import importlib.util
import inspect
from datetime import datetime
from io import StringIO
from pathlib import Path
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import BackgroundTasks, HTTPException
from fastapi.params import Param
from sqlalchemy.dialects import postgresql
from sqlmodel import SQLModel, Session, create_engine, select
from starlette.requests import Request

import app.models
from app.api.events import create_event, update_event, list_events, list_events_map, build_event_response
from app.api.collections import build_collection_events_query
from app.api.admin import list_admin_events
from app.core.category_filters import event_category_filter
from app.models.category import Category
from app.models.collection import Collection
from app.models.event import Event
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate


@pytest.fixture
def data():
    engine = create_engine('sqlite:///:memory:')
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        host = User(id=uuid4().hex, email='categories@example.org', username='category_host',
                    is_trusted_organizer=True, trust_level=2)
        categories = [Category(id=uuid4().hex, name=name, slug=slug) for name, slug in
                      [('Festivals', 'festivals'), ('Food & Drink', 'food-drink'), ('Music', 'music')]]
        session.add_all([host, *categories])
        session.commit()
        with patch('app.api.events.resend_email_service.send_event_approved', new_callable=AsyncMock):
            yield session, host, categories
    engine.dispose()


def call(handler, **overrides):
    """Use actual route handlers, resolving framework defaults without HTTP/lifespan."""
    handler = inspect.unwrap(handler)
    values = {key: value.default.default if isinstance(value.default, Param) else value.default
              for key, value in inspect.signature(handler).parameters.items()
              if value.default is not inspect.Parameter.empty}
    values.update(overrides)
    result = handler(**values)
    if not inspect.isawaitable(result):
        return result
    # These routes use synchronous sessions; the only awaited operation is a
    # mocked email. Drive to completion without Windows socketpair/event-loop
    # setup (blocked in this sandbox). Any real async I/O must fail this check.
    try:
        result.send(None)
    except StopIteration as completed:
        return completed.value
    finally:
        result.close()
    pytest.fail('Unexpected asynchronous I/O in isolated category route check')


def create(data, secondary=None, **extra):
    session, host, categories = data
    payload = dict(title='Highland gathering ' + uuid4().hex, date_start=datetime(2030, 7, 1, 10),
                   date_end=datetime(2030, 7, 1, 12), location_name='Inverness', category_id=categories[0].id)
    if secondary is not None:
        payload['secondary_category_id'] = secondary
    payload.update(extra)
    return call(create_event, request=Request({'type': 'http', 'method': 'POST', 'path': '/api/events', 'headers': []}),
                event_data=EventCreate(**payload), current_user=host, session=session, background_tasks=BackgroundTasks())


def edit(data, event_id, **patch):
    session, host, _ = data
    return call(update_event, event_id=str(event_id), event_data=EventUpdate(**patch), current_user=host,
                session=session, background_tasks=BackgroundTasks(), unlink_venue=False)


def test_existing_primary_only_and_primary_secondary_create_responses(data):
    session, _, cats = data
    primary_only = create(data)
    assert primary_only.secondary_category_id is None and primary_only.secondary_category is None
    assert primary_only.category.id == cats[0].id
    both = create(data, cats[1].id)
    assert both.category.id == cats[0].id
    assert both.secondary_category.id == cats[1].id
    assert both.secondary_category.slug == 'food-drink'
    assert session.get(Event, both.id.hex).secondary_category_id == cats[1].id


def test_edit_add_change_preserve_and_remove_secondary(data):
    _, _, cats = data
    row = create(data)
    assert edit(data, row.id, secondary_category_id=cats[1].id).secondary_category.id == cats[1].id
    assert edit(data, row.id, title='Updated gathering').secondary_category_id == cats[1].id
    assert edit(data, row.id, secondary_category_id=cats[2].id).secondary_category.id == cats[2].id
    cleared = edit(data, row.id, secondary_category_id=None)
    assert cleared.secondary_category_id is None and cleared.secondary_category is None
    assert cleared.category.id == cats[0].id


def test_duplicate_categories_rejected_on_create_and_partial_updates(data):
    session, _, cats = data
    with pytest.raises(HTTPException) as error:
        create(data, str(UUID(cats[0].id)))  # Dashed vs stored hex.
    assert error.value.status_code == 422
    row = create(data, cats[1].id)
    for patch in [{'category_id': cats[1].id}, {'secondary_category_id': cats[0].id},
                  {'category_id': cats[2].id, 'secondary_category_id': cats[2].id}]:
        with pytest.raises(HTTPException) as error:
            edit(data, row.id, **patch)
        assert error.value.status_code == 422
        assert session.get(Event, row.id.hex).category_id == cats[0].id
        assert session.get(Event, row.id.hex).secondary_category_id == cats[1].id


def test_invalid_secondary_and_missing_primary_are_rejected(data):
    with pytest.raises(HTTPException) as error:
        create(data, uuid4().hex)
    assert error.value.status_code == 404
    with pytest.raises(HTTPException) as error:
        create(data, category_id='')
    assert error.value.status_code == 422
    row = create(data)
    with pytest.raises(HTTPException) as error:
        edit(data, row.id, category_id=None)
    assert error.value.status_code == 422


@pytest.mark.parametrize('filter_kind', ['slug', 'id', 'ids', 'city'])
def test_public_listing_matches_either_category_once(data, filter_kind):
    session, _, cats = data
    row = create(data, cats[1].id)
    for cat in cats[:2]:
        filters = {'category': cat.slug} if filter_kind in ('slug', 'city') else {
            'category_id' if filter_kind == 'id' else 'category_ids': cat.id}
        if filter_kind == 'city':
            filters['city_filter'] = 'Inverness'
        response = call(list_events, request=Request({'type': 'http', 'method': 'GET', 'path': '/api/events', 'headers': []}),
                        session=session, current_user=None, include_past=True, **filters)
        assert [item.id for item in response.events] == [row.id]
        assert response.total == 1
    both = call(list_events, request=Request({'type': 'http', 'method': 'GET', 'path': '/api/events', 'headers': []}),
                session=session, current_user=None, category_ids=','.join(cat.id for cat in cats[:2]), include_past=True)
    assert [item.id for item in both.events] == [row.id]


def test_collection_and_map_category_filters_and_primary_style_contract(data):
    session, _, cats = data
    row = create(data, cats[1].id, latitude=57.48, longitude=-4.22)
    for cat in cats[:2]:
        collection = Collection(title='Category collection', slug='category-collection', filter_params={'category_ids': [cat.id]})
        assert [event.id for event in session.exec(build_collection_events_query(collection, session)).all()] == [row.id.hex]
        response = call(list_events_map, request=Request({'type': 'http', 'method': 'GET', 'path': '/api/events/map', 'headers': [], 'query_string': b''}), session=session, category_id=cat.id,
                        date_from=datetime(2030, 7, 1), date_to=datetime(2030, 7, 2))
        assert [item.id for item in response] == [row.id]
        assert response[0].category.id == cats[0].id  # Never replace primary for styling.
        assert response[0].secondary_category.id == cats[1].id
    sql = str(select(Event).where(event_category_filter([cat.id for cat in cats[:2]])).compile(dialect=postgresql.dialect()))
    assert 'events.category_id IN' in sql and 'events.secondary_category_id IN' in sql and ' OR ' in sql
    assert 'JOIN' not in sql  # OR predicate cannot multiply rows.


def test_admin_create_edit_and_category_listing(data):
    session, host, cats = data
    host.is_admin = True
    session.commit()
    row = create(data, cats[1].id)
    assert edit(data, row.id, secondary_category_id=cats[2].id).secondary_category_id == cats[2].id
    response = call(list_admin_events, session=session, admin=host, category_id=cats[2].id)
    assert [str(item.id) for item in response.data] == [row.id.hex]


def test_legacy_null_categories_serialize_and_relationships_are_unambiguous(data):
    session, host, cats = data
    legacy = Event(title='Legacy event', date_start=datetime(2030, 7, 2, 10), date_end=datetime(2030, 7, 2, 12),
                   organizer_id=host.id, category_id=cats[0].id)
    session.add(legacy)
    session.commit()
    response = build_event_response(legacy, session)
    assert response.secondary_category is None
    assert legacy in cats[0].events and not cats[0].secondary_events


def test_new_recurring_children_and_series_metadata_preserve_secondary(data):
    session, _, cats = data
    parent = create(data, cats[1].id, is_recurring=True, frequency='WEEKLY',
                    recurrence_end_date=datetime(2030, 7, 31))
    children = session.exec(select(Event).where(Event.parent_event_id == parent.id.hex)).all()
    assert children and all(child.secondary_category_id == cats[1].id for child in children)
    edit(data, parent.id, secondary_category_id=cats[2].id)
    session.expire_all()
    assert all(child.secondary_category_id == cats[2].id for child in children)


def test_migration_adds_only_nullable_secondary_fk_index_and_has_postgres_downgrade():
    file = next((Path(__file__).parents[1] / 'alembic/versions').glob('0946aa625cd0_*.py'))
    spec = importlib.util.spec_from_file_location('secondary_migration', file)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    output = StringIO()
    migration.op = Operations(MigrationContext.configure(dialect_name='postgresql', opts={'as_sql': True, 'output_buffer': output}))
    migration.upgrade()
    sql = output.getvalue()
    assert 'ADD COLUMN secondary_category_id VARCHAR' in sql
    assert 'FOREIGN KEY(secondary_category_id) REFERENCES categories (id) ON DELETE SET NULL' in sql
    assert 'CREATE INDEX ix_events_secondary_category_id' in sql
    assert 'NOT NULL' not in sql and 'UPDATE ' not in sql and 'DROP ' not in sql
    output.truncate(0)
    output.seek(0)
    migration.downgrade()
    assert 'DROP CONSTRAINT fk_events_secondary_category_id_categories' in output.getvalue()
