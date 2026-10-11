from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

import app.models  # noqa: F401 -- register relationships
from app.models.event import Event
from app.scripts.repair_missing_recurrence_rules import restore_missing_rule
from app.services.recurrence import replenish_recurring_parent


@pytest.fixture
def series():
    engine = create_engine('sqlite:///:memory:')
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        parent = Event(id=uuid4().hex, title='Lybster Wednesday Social', is_recurring=True,
                       date_start=datetime(2026, 2, 25, 10), date_end=datetime(2026, 2, 25, 12, 30),
                       recurrence_group_id=uuid4().hex, recurrence_rule=None, recurrence_end_date=None)
        children = [Event(id=uuid4().hex, title=parent.title, parent_event_id=parent.id,
                          recurrence_group_id=parent.recurrence_group_id,
                          date_start=parent.date_start + timedelta(weeks=week),
                          date_end=parent.date_end + timedelta(weeks=week)) for week in range(1, 4)]
        session.add_all([parent, *children])
        session.commit()
        yield session, parent, children
    engine.dispose()


def test_weekly_wednesday_dry_run_and_preview_never_write(series):
    session, parent, children = series
    snapshot = {row.id: row.model_dump() for row in [parent, *children]}
    with patch.object(session, 'flush', side_effect=AssertionError('dry-run flushed')), \
         patch.object(session, 'add', side_effect=AssertionError('dry-run added')), \
         patch.object(session, 'commit', side_effect=AssertionError('dry-run committed')):
        report = restore_missing_rule(session, parent_id=parent.id, preview_next=True,
                                      now=datetime(2026, 3, 20), emit=lambda _: None)
    assert report['inferred_rule'] == 'FREQ=WEEKLY;BYDAY=WE'
    assert report['dry_run'] and report['existing_rule'] is None
    assert report['would_generate'][0] == {'date_start': '2026-03-25T10:00:00', 'date_end': '2026-03-25T12:30:00'}
    assert all(datetime.fromisoformat(row['date_start']).weekday() == 2 for row in report['would_generate'])
    assert not session.new and not session.dirty
    assert {row.id: row.model_dump() for row in [parent, *children]} == snapshot
    assert len(session.exec(select(Event)).all()) == 4


def test_apply_only_restores_exact_rule_and_enables_real_replenishment(series):
    session, parent, children = series
    snapshot = {row.id: row.model_dump() for row in [parent, *children]}
    with pytest.raises(ValueError, match='no supported recurrence rule'):
        replenish_recurring_parent(session, parent.id, now=datetime(2026, 3, 20))
    report = restore_missing_rule(session, parent_id=parent.id, apply=True, preview_next=True,
                                  now=datetime(2026, 3, 20), emit=lambda _: None)
    session.commit()
    assert len(session.exec(select(Event)).all()) == 4
    for row in [parent, *children]:
        expected = dict(snapshot[row.id])
        if row is parent:
            expected['recurrence_rule'] = 'FREQ=WEEKLY;BYDAY=WE'
        assert row.model_dump() == expected
    generated = replenish_recurring_parent(session, parent.id, now=datetime(2026, 3, 20), horizon_days=14)
    assert [row.date_start for row in generated] == [datetime(2026, 3, 25, 10), datetime(2026, 4, 1, 10)]
    assert [row.date_start.isoformat() for row in generated] == [row['date_start'] for row in report['would_generate'][:2]]
    assert all(row.parent_event_id == parent.id for row in generated)
    session.rollback()  # Test generation only; maintenance never generates children.


@pytest.mark.parametrize('defect', ['missing', 'too-few', 'gap', 'weekday', 'time', 'monthly', 'group', 'duplicate'])
def test_ambiguous_history_rejected_without_any_repair(series, defect):
    session, parent, children = series
    if defect in ('missing', 'too-few'):
        for child in children if defect == 'missing' else children[1:]:
            session.delete(child)
    elif defect == 'gap':
        children[-1].date_start += timedelta(weeks=1)
    elif defect == 'weekday':
        children[-1].date_start += timedelta(days=1)
    elif defect == 'time':
        children[-1].date_start += timedelta(minutes=30)
    elif defect == 'monthly':
        for index, child in enumerate(children, 1):
            child.date_start = parent.date_start + timedelta(days=28 * index)
    elif defect == 'group':
        children[-1].recurrence_group_id = uuid4().hex
    else:
        children[-1].date_start = children[-2].date_start
    session.commit()
    with pytest.raises(ValueError):
        restore_missing_rule(session, parent_id=parent.id, apply=True, emit=lambda _: None)
    assert parent.recurrence_rule is None and not session.dirty


def test_finite_cutoff_and_unrelated_parent_are_preserved(series):
    session, parent, _ = series
    parent.recurrence_end_date = datetime(2026, 6, 1)
    other = Event(id=uuid4().hex, title='Unrelated', is_recurring=True, recurrence_rule=None,
                  date_start=parent.date_start, date_end=parent.date_end, recurrence_group_id=uuid4().hex)
    session.add(other)
    session.commit()
    report = restore_missing_rule(session, parent_id=parent.id, apply=True, preview_next=True, emit=lambda _: None)
    session.commit()
    assert parent.recurrence_end_date == datetime(2026, 6, 1)
    assert not report['ongoing_replenishment_eligible'] and report['would_generate'] == []
    assert other.recurrence_rule is None


def test_apply_failure_rolls_back_rule(series):
    session, parent, _ = series
    parent_id = parent.id
    session.rollback()
    with pytest.raises(RuntimeError, match='write failure'):
        with session.begin():
            with patch.object(session, 'flush', side_effect=RuntimeError('write failure')):
                restore_missing_rule(session, parent_id=parent_id, apply=True, emit=lambda _: None)
    assert session.get(Event, parent_id).recurrence_rule is None


def test_existing_rule_is_never_overwritten(series):
    session, parent, _ = series
    parent.recurrence_rule = 'FREQ=MONTHLY'
    session.commit()
    with pytest.raises(ValueError, match='already has'):
        restore_missing_rule(session, parent_id=parent.id, apply=True, emit=lambda _: None)


def test_consistent_fortnightly_rule_uses_existing_format(series):
    session, parent, children = series
    for index, child in enumerate(children, 1):
        child.date_start = parent.date_start + timedelta(weeks=2 * index)
    session.commit()
    report = restore_missing_rule(session, parent_id=parent.id, emit=lambda _: None)
    assert report['inferred_rule'] == 'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE'
