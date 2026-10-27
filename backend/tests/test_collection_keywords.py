"""Isolated collection/public-search parity and multi-keyword regression tests."""
import inspect
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.params import Param
from sqlalchemy.dialects import postgresql
from sqlmodel import Session, SQLModel, create_engine, select
from starlette.requests import Request

import app.models
from app.api.collections import (build_collection_events_query, create_collection, update_collection,
                                get_collection_events, preview_collection_events)
from app.api.events import list_events
from app.core.event_text_search import collection_keywords, event_text_search_condition
from app.models.event import Event
from app.models.category import Category
from app.models.collection import Collection
from app.models.tag import Tag, EventTag
from app.models.venue import Venue
from app.models.user import User
from app.schemas.collection import CollectionCreate, CollectionUpdate


def call(handler, **overrides):
    """Run actual handlers without HTTP lifespan or Windows socketpair setup."""
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
    pytest.fail('Unexpected async I/O in isolated collection test')


@pytest.fixture
def data():
    engine = create_engine('sqlite:///:memory:')
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        admin = User(id=uuid4().hex, username='keyword_admin', email='keywords@example.org', is_admin=True)
        category = Category(id=uuid4().hex, name='Music', slug='music')
        session.add_all([admin, category])
        session.commit()
        yield session, admin, category
    engine.dispose()


def event(data, title='Unrelated event', tags=(), **extra):
    session, _, category = data
    fields = dict(id=uuid4().hex, title=f'{title} {uuid4().hex}', description='Unrelated description', category_id=category.id,
                  organizer_id=data[1].id,
                  date_start=datetime(2030, 12, 5, 18), date_end=datetime(2030, 12, 5, 20),
                  status='published', is_cancelled=False)
    fields.update(extra)
    row = Event(**fields)
    session.add(row)
    for name in tags:
        tag = session.exec(select(Tag).where(Tag.name == name)).first()
        if not tag:
            tag = Tag(name=name)
            session.add(tag)
            session.flush()
        session.add(EventTag(event_id=row.id, tag_id=tag.id))
    session.commit()
    return row


def collection(params=None, **extra):
    return Collection(title='Christmas collection', slug='christmas', target_link='/collections/christmas',
                      filter_params=params or {}, **extra)


def matches(data, params, **boundaries):
    return {row.id for row in data[0].exec(build_collection_events_query(collection(params, **boundaries), data[0])).all()}


def test_single_keyword_matches_real_public_search_and_collection_routes(data):
    session, _, _ = data
    expected = {
        event(data, title='Pre-CHRISTMAS ceilidh').id,
        event(data, description='A christmas workshop').id,
        event(data, tags=['christmas', 'other']).id,
        event(data, tags=['pre-christmas']).id,
        event(data, address_full='Christmas Lane').id,
        event(data, postcode='CHRISTMAS').id,
        event(data, location_name='Christmas Hall').id,
    }
    venue = Venue(id=uuid4().hex, name='Hall', address='Ordinary', formatted_address='Christmas Square',
                  latitude=57.5, longitude=-4.2, geohash='gfh')
    category = Category(id=uuid4().hex, name='Christmas activities', slug='seasonal')
    session.add_all([venue, category]); session.commit()
    expected.add(event(data, venue_id=venue.id).id)
    expected.add(event(data, category_id=category.id).id)
    event(data)
    event(data, title='Christmas draft', status='draft')
    event(data, title='Christmas past', date_start=datetime(2020, 12, 1), date_end=datetime(2020, 12, 2))
    public = call(list_events, request=Request({'type': 'http', 'headers': [], 'method': 'GET', 'path': '/api/events'}),
                  q='Christmas', session=session, current_user=None, limit=1000)
    assert {str(row.id).replace('-', '') for row in public.events} == expected
    assert matches(data, {'q': 'Christmas'}) == expected
    assert matches(data, {'keywords': ['Christmas']}) == expected
    saved = collection({'keywords': ['Christmas']}); session.add(saved); session.commit()
    result = get_collection_events('christmas', skip=0, limit=1000, session=session)
    assert {row.id for row in result['events']} == expected
    assert result['total'] == len(expected)  # Multiple matching tags do not duplicate rows.


def test_each_keyword_uses_public_tag_slug_normalization_and_phrase_matching(data):
    tagged = event(data, tags=['christmas-party'])
    phrase = event(data, title='A Christmas Party')
    event(data, title='Christmas', description='Party')
    assert matches(data, {'keywords': ['Christmas Party']}) == {tagged.id, phrase.id}
    sql = str(select(Event).where(event_text_search_condition('Christmas Party')).compile(dialect=postgresql.dialect()))
    assert 'ILIKE' in sql and 'EXISTS' in sql


def test_any_and_all_keywords_are_independent_including_different_tags(data):
    christmas = event(data, title='Christmas')
    santa = event(data, description='Santa')
    both = event(data, title='Christmas', description='Santa')
    tagged = event(data, tags=['christmas', 'santa'])
    neither = event(data)
    terms = [' Christmas ', 'santa', 'CHRISTMAS', '']
    assert matches(data, {'keywords': terms, 'combine_operator': 'or'}) == {christmas.id, santa.id, both.id, tagged.id}
    assert matches(data, {'keywords': terms, 'combine_operator': 'and'}) == {both.id, tagged.id}
    assert neither.id not in matches(data, {'keywords': terms})


def test_category_block_and_absolute_collection_boundaries_remain_intact(data):
    session, _, music = data
    other = Category(id=uuid4().hex, name='Other', slug='other')
    session.add(other); session.commit()
    host, outsider = uuid4().hex, uuid4().hex
    category_only = event(data, organizer_profile_id=host)
    keyword_only = event(data, title='Santa', category_id=other.id, organizer_profile_id=host)
    both = event(data, title='Santa', organizer_profile_id=host)
    event(data, title='Santa', organizer_profile_id=outsider)
    params = {'category_ids': [music.id], 'keywords': ['Santa'], 'combine_operator': 'or'}
    assert matches(data, params, organizer_profile_ids=[host]) == {category_only.id, keyword_only.id, both.id}
    params['combine_operator'] = 'and'
    assert matches(data, params, organizer_profile_ids=[host]) == {both.id}
    params.update(exclude_event_ids=[both.id])
    assert matches(data, params, organizer_profile_ids=[host]) == set()


def test_date_venue_price_age_and_recurrence_filters_not_bypassed_by_any(data):
    venue_id = uuid4().hex
    wanted = event(data, title='Santa', venue_id=venue_id, price=0, age_restriction='all_ages')
    event(data, title='Santa', venue_id=uuid4().hex, price=0, age_restriction='all_ages')
    event(data, title='Santa', venue_id=venue_id, price=12, age_restriction='all_ages')
    event(data, title='Santa', venue_id=venue_id, price=0, age_restriction='18_plus')
    event(data, title='Santa', venue_id=venue_id, price=0, age_restriction='all_ages', is_recurring=True)
    event(data, title='Santa', venue_id=venue_id, price=0, age_restriction='all_ages',
          date_start=datetime(2031, 1, 1), date_end=datetime(2031, 1, 2))
    assert matches(data, {'keywords': ['Santa', 'Xmas'], 'combine_operator': 'or', 'price': 'free',
                         'age_restriction': 'all_ages', 'is_recurring': False},
                   specific_venue_ids=[venue_id], fixed_end_date=datetime(2030, 12, 31).date()) == {wanted.id}


def test_legacy_and_array_json_roundtrip_preview_is_read_only_and_admin_only(data):
    session, admin, _ = data
    wanted = event(data, tags=['christmas'])
    saved = create_collection(CollectionCreate(title='Legacy', target_link='/collections/legacy',
        filter_params={'q': 'Christmas'}), admin, session)
    assert collection_keywords(saved.filter_params) == ['Christmas']
    params = {'keywords': [' Christmas ', 'Santa', 'CHRISTMAS', ''], 'combine_operator': 'or'}
    update_collection(saved.id, CollectionUpdate(filter_params=params), admin, session)
    session.expire_all()
    assert collection_keywords(session.get(Collection, saved.id).filter_params) == ['Christmas', 'Santa']
    before = len(session.exec(select(Collection)).all())
    payload = CollectionCreate(title='Unsaved', target_link='', filter_params=params)
    preview = preview_collection_events(payload, limit=100, current_user=admin, session=session)
    assert {row.id for row in preview['events']} == {wanted.id}
    assert len(session.exec(select(Collection)).all()) == before
    with pytest.raises(HTTPException) as error:
        preview_collection_events(payload, limit=100, current_user=User(is_admin=False), session=session)
    assert error.value.status_code == 403


def test_geographic_boundary_remains_strict_with_keywords(data):
    session = data[0]
    inside = Venue(id=uuid4().hex, name='Inside', address='Christmas Road', latitude=58, longitude=-4, geohash='gfh')
    outside = Venue(id=uuid4().hex, name='Outside', address='Christmas Road', latitude=55, longitude=-3, geohash='gcp')
    session.add_all([inside, outside]); session.commit()
    wanted = event(data, venue_id=inside.id)
    event(data, venue_id=outside.id)
    assert matches(data, {'keywords': ['Christmas'], 'combine_operator': 'or'},
                   min_lat=57, max_lat=59, min_lng=-6, max_lng=-3) == {wanted.id}


def test_legacy_phrase_and_explicit_empty_array_precedence():
    assert collection_keywords({'q': ' Christmas Santa '}) == ['Christmas Santa']
    assert collection_keywords({'q': 'Old', 'keywords': []}) == []
    assert collection_keywords({'keywords': ['Santa', 'santa', None, '  ', 'Xmas']}) == ['Santa', 'Xmas']


def test_existing_collection_cancelled_eligibility_is_not_changed(data):
    # Text parity does not silently rewrite the pre-existing collection policy:
    # it is published-only; the anonymous public list also excludes cancellations.
    row = event(data, title='Christmas', is_cancelled=True)
    assert matches(data, {'q': 'Christmas'}) == {row.id}
