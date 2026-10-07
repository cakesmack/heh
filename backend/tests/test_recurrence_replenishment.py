from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from dateutil.rrule import rrulestr
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

from app.models import Category, Event, Tag, User, Venue
from app.services.recurrence import replenish_recurring_parent
from app.scripts.replenish_recurring_events import main, run_replenishment


@compiles(JSONB, 'sqlite')
def compile_jsonb(type_, compiler, **kw):
    return 'JSON'


@pytest.fixture
def engine():
    engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    return engine


def parent(session, rule='FREQ=WEEKLY;BYDAY=MO,WE', **patches):
    user = User(id=uuid4().hex, email=f'{uuid4().hex}@example.org', username=uuid4().hex)
    category = Category(id=uuid4().hex, name=f'Community {uuid4().hex}', slug=uuid4().hex)
    session.add(user)
    session.add(category)
    session.flush()
    event = Event(id=uuid4().hex, title='Series', organizer_id=user.id, category_id=category.id,
                  date_start=datetime(2026, 9, 7, 10), date_end=datetime(2026, 9, 7, 12),
                  is_recurring=True, recurrence_rule=rule, recurrence_group_id=uuid4().hex, **patches)
    session.add(event)
    session.commit()
    return event


@pytest.mark.parametrize('rule', ['FREQ=WEEKLY;BYDAY=MO,WE', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE',
                                      'FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1', 'FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=7'])
def test_append_idempotent_preserves_rule_phase_and_existing_children(engine, rule):
    now = datetime(2026, 10, 7, 10)
    marker = datetime(2026, 10, 21, 10)
    with Session(engine) as session:
        event = parent(session, rule)
        old = Event(id=uuid4().hex, title='Individually edited', organizer_id=event.organizer_id, category_id=event.category_id,
                    date_start=marker, date_end=marker + timedelta(hours=3), parent_event_id=event.id,
                    recurrence_group_id=event.recurrence_group_id, is_cancelled=True)
        session.add(old)
        session.commit()
        old_id = old.id
        expected = list(rrulestr(rule, dtstart=event.date_start).between(marker, now + timedelta(days=180), inc=True))
        expected = [date for date in expected if date > marker]
        added = replenish_recurring_parent(session, event.id, now=now)
        session.commit()
        assert [child.date_start for child in added] == expected
        assert all(child.recurrence_group_id == event.recurrence_group_id for child in added)
        assert all(child.date_end - child.date_start == timedelta(hours=2) for child in added)
        assert replenish_recurring_parent(session, event.id, now=now) == []
        session.commit()
        assert session.get(Event, old_id).title == 'Individually edited'
        assert session.get(Event, old_id).is_cancelled
        assert session.get(Event, event.id).recurrence_rule == rule
        assert len(session.exec(select(Event).where(Event.parent_event_id == event.id)).all()) == len(expected) + 1


def test_no_historical_gaps_are_filled_and_horizon_rolls_forward(engine):
    now = datetime(2026, 10, 7, 10)
    with Session(engine) as session:
        event = parent(session, is_all_day=True)
        tag = Tag(id=uuid4().hex, name='Community', slug=uuid4().hex)
        venue = Venue(id=uuid4().hex, name='Hall', address='Street', city='Inverness', postcode='IV1 1AA', latitude=57.4, longitude=-4.2)
        session.add(tag)
        session.add(venue)
        event.tags = [tag]
        event.participating_venues = [venue]
        session.commit()
        children = replenish_recurring_parent(session, event.id, now=now)
        session.commit()
        assert children and all(child.date_start > now for child in children)
        assert children[0].is_all_day
        assert children[0].tags[0].id == tag.id
        assert children[0].participating_venues[0].id == venue.id
        first_id = children[0].id
        session.delete(children[0])
        session.commit()
        assert replenish_recurring_parent(session, event.id, now=now) == []
        new = replenish_recurring_parent(session, event.id, now=now + timedelta(days=30))
        session.commit()
        assert new
        assert session.get(Event, first_id) is None
        assert min(child.date_start for child in new) > max(child.date_start for child in children)


@pytest.mark.parametrize('patches,rule', [({'recurrence_end_date': datetime(2026, 12, 1)}, 'FREQ=WEEKLY'),
                                         ({}, 'FREQ=WEEKLY;UNTIL=20261201T235959Z'), ({}, 'FREQ=WEEKLY;COUNT=10'),
                                         ({'is_cancelled': True}, 'FREQ=WEEKLY')])
def test_finite_and_cancelled_series_are_not_replenished(engine, patches, rule):
    with Session(engine) as session:
        event = parent(session, rule, **patches)
        assert replenish_recurring_parent(session, event.id, now=datetime(2026, 10, 7)) == []


def test_job_continues_after_failure_logs_id_and_reports_failure(engine, caplog):
    with Session(engine) as session:
        bad_id = parent(session, 'NOT_A_RULE').id
        good_id = parent(session).id
    def fixed_time(session, event_id):
        return replenish_recurring_parent(session, event_id, now=datetime(2026, 10, 7))
    with patch('app.scripts.replenish_recurring_events.replenish_recurring_parent', side_effect=fixed_time):
        assert run_replenishment(engine) == [bad_id]
    assert bad_id in caplog.text
    with Session(engine) as session:
        assert session.exec(select(Event).where(Event.parent_event_id == good_id)).first() is not None
        assert session.exec(select(Event).where(Event.parent_event_id == bad_id)).first() is None


@pytest.mark.parametrize('failures,exit_code', [([], 0), (['failed-event'], 1)])
def test_command_exit_status(engine, failures, exit_code):
    with patch('app.core.database.engine', engine), patch('app.scripts.replenish_recurring_events.run_replenishment', return_value=failures):
        assert main() == exit_code
