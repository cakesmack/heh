from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4
import json

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.main import app  # Registers existing models, with test-only environment.
from app.api.admin import list_admin_events
from app.core.occurrences import occurrence_filter
from app.core.query_utils import deduplicate_recurring_events
from app.models.event import Event
from app.models.category import Category
from app.models.user import User
from app.services.recurrence import generate_recurring_instances, replenish_recurring_parent
from app.scripts.repair_recurring_occurrence_durations import inspect_durations, main


@pytest.fixture
def series():
    engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        user = User(id=uuid4().hex, email='duration@example.org', username='duration', is_admin=True)
        category = Category(id=uuid4().hex, name='Community', slug='duration-community')
        session.add_all([user, category])
        parent = Event(id=uuid4().hex, title='Lybster Wednesday Social', organizer_id=user.id, category_id=category.id,
                       date_start=datetime(2026, 2, 25, 10), date_end=datetime(2026, 2, 25, 12, 30),
                       is_recurring=True, recurrence_rule='FREQ=WEEKLY;BYDAY=WE', recurrence_group_id=uuid4().hex,
                       status='published')
        session.add(parent)
        session.commit()
        yield session, parent, user
    engine.dispose()


@pytest.mark.parametrize('start,duration', [
    (datetime(2026, 2, 25, 10), timedelta(hours=2, minutes=30)),
    (datetime(2026, 2, 25, 20), timedelta(hours=6)),
    (datetime(2026, 2, 25, 10), timedelta(days=3, hours=2, minutes=30)),
], ids=['same-day', 'overnight', 'multi-day'])
@pytest.mark.parametrize('replenish', [False, True], ids=['initial', 'replenishment'])
def test_initial_and_replenishment_preserve_exact_parent_duration(series, start, duration, replenish):
    session, parent, _ = series
    parent.date_start, parent.date_end = start, start + duration
    session.commit()
    if replenish:
        children = replenish_recurring_parent(session, parent.id, now=datetime(2026, 3, 1), horizon_days=14)
        session.commit()
    else:
        children = generate_recurring_instances(session, parent, through=datetime(2026, 3, 12), raise_errors=True)
    assert [child.date_start for child in children] == [start + timedelta(days=7), start + timedelta(days=14)]
    assert [child.date_end for child in children] == [start + timedelta(days=7) + duration, start + timedelta(days=14) + duration]
    assert all(not child.is_recurring and child.parent_event_id == parent.id for child in children)
    assert parent.date_start == start and parent.date_end == start + duration


def test_correct_generated_children_are_past_and_do_not_overlap_october(series, monkeypatch):
    session, parent, user = series
    children = generate_recurring_instances(session, parent, through=datetime(2026, 10, 15), raise_errors=True)
    march = next(child for child in children if child.date_start == datetime(2026, 3, 4, 10))
    october = next(child for child in children if child.date_start == datetime(2026, 10, 7, 10))
    now = datetime(2026, 10, 1, 12)
    october_window = occurrence_filter(datetime(2026, 10, 1), datetime(2026, 10, 14, 23, 59))
    assert session.exec(select(Event).where(Event.id == march.id, ~occurrence_filter(now))).one().id == march.id
    matches = session.exec(select(Event).where(october_window)).all()
    assert march.id not in {row.id for row in matches} and october.id in {row.id for row in matches}
    representatives, total = deduplicate_recurring_events(session, select(Event).where(october_window))
    assert total == 1 and [row.id for row in representatives] == [october.id]
    monkeypatch.setattr('app.core.occurrences.event_now', lambda: now)
    response = list_admin_events(page=1, page_size=100, category_id=None, venue_id=None,
                                 search='Lybster', status_filter=None, include_past=False,
                                 admin=user, session=session)
    assert march.id not in {row.id for row in response.data}
    assert october.id in {row.id for row in response.data}


def test_dry_run_reports_corruption_and_intentional_edits_without_writes(series):
    session, parent, _ = series
    children = generate_recurring_instances(session, parent, through=datetime(2026, 3, 12), raise_errors=True)
    children[0].date_end = datetime(2027, 1, 6, 12, 30)
    children[1].date_end += timedelta(hours=1)  # Independently edited duration is supported.
    session.commit()
    for child in children:
        session.refresh(child)
    snapshot = [child.model_dump() for child in children]
    output = []
    with patch.object(session, 'commit', side_effect=AssertionError('dry run committed')):
        counts = inspect_durations(session, emit=output.append)
    assert (counts.inspected, counts.malformed, counts.repaired) == (2, 2, 0)
    reports = [json.loads(line) for line in output]
    assert reports[0]['expected_end'] == '2026-03-04T12:30:00'
    assert reports[0]['existing_end'] == '2027-01-06T12:30:00'
    assert all(not report['automatic_repair_safe'] for report in reports[:-1])
    assert [child.model_dump() for child in children] == snapshot
    assert not session.dirty


def test_missing_parent_is_reported_and_series_filter_limits_analysis(series):
    session, parent, _ = series
    children = generate_recurring_instances(session, parent, through=datetime(2026, 3, 5), raise_errors=True)
    children[0].parent_event_id = uuid4().hex
    session.commit()
    output = []
    counts = inspect_durations(session, emit=output.append)
    assert counts.unverifiable == 1 and counts.repaired == 0
    assert json.loads(output[0])['reason'] == 'missing parent'
    with pytest.raises(ValueError, match='exactly one canonical'):
        inspect_durations(session, parent_id=uuid4().hex, emit=lambda _: None)


@pytest.mark.parametrize('target', ['parent_id', 'recurrence_group_id'])
def test_explicit_series_repair_changes_only_malformed_child_ends(series, target):
    session, parent, _ = series
    children = generate_recurring_instances(session, parent, through=datetime(2026, 3, 12), raise_errors=True)
    for child in children:
        child.date_end += timedelta(days=308)
    other = Event(id=uuid4().hex, title='Unrelated child', parent_event_id=uuid4().hex,
                  date_start=datetime(2026, 3, 4, 10), date_end=datetime(2027, 1, 6, 12, 30))
    session.add(other)
    session.commit()
    snapshot = {row.id: row.model_dump() for row in [parent, other, *children]}
    target_id = parent.id if target == 'parent_id' else parent.recurrence_group_id
    counts = inspect_durations(session, apply=True, **{target: target_id}, emit=lambda _: None)
    session.commit()
    assert counts.inspected == counts.malformed == counts.repaired == 2
    for row in [parent, other, *children]:
        expected = dict(snapshot[row.id])
        if row in children:
            expected['date_end'] = row.date_start + timedelta(hours=2, minutes=30)
        assert row.model_dump() == expected
    assert inspect_durations(session, apply=True, **{target: target_id}, emit=lambda _: None).repaired == 0


def test_target_with_ambiguous_child_refuses_all_writes(series):
    session, parent, _ = series
    children = generate_recurring_instances(session, parent, through=datetime(2026, 3, 12), raise_errors=True)
    children[0].date_end += timedelta(days=308)
    children[1].recurrence_group_id = uuid4().hex
    session.commit()
    original = children[0].date_end
    with pytest.raises(ValueError, match='unverifiable'):
        inspect_durations(session, parent_id=parent.id, apply=True, emit=lambda _: None)
    assert children[0].date_end == original and not session.dirty


def test_failed_target_repair_rolls_back_transaction(series):
    session, parent, _ = series
    children = generate_recurring_instances(session, parent, through=datetime(2026, 3, 5), raise_errors=True)
    children[0].date_end += timedelta(days=308)
    session.commit()
    child_id, parent_id, original = children[0].id, parent.id, children[0].date_end
    session.rollback()  # Close the read transaction before testing the owner boundary.
    with pytest.raises(RuntimeError, match='simulated write failure'):
        with session.begin():
            with patch.object(session, 'flush', side_effect=RuntimeError('simulated write failure')):
                inspect_durations(session, parent_id=parent_id, apply=True, emit=lambda _: None)
    assert session.get(Event, child_id).date_end == original


def test_apply_refuses_before_opening_database(capsys):
    with pytest.raises(SystemExit) as error:
        main(['--apply'])
    assert error.value.code == 2
    assert 'No database connection or writes were made' in capsys.readouterr().err


def corrupt_parent_and_children(session, parent):
    parent.date_end += timedelta(days=308)
    session.commit()
    return generate_recurring_instances(session, parent, through=datetime(2026, 3, 12), raise_errors=True)


@pytest.mark.parametrize('target', ['parent_id', 'recurrence_group_id'])
def test_explicit_150_minutes_repairs_corrupt_parent_and_children_only(series, target):
    session, parent, _ = series
    children = corrupt_parent_and_children(session, parent)
    unrelated_parent = Event(id=uuid4().hex, title='Other series', is_recurring=True,
                             recurrence_group_id=uuid4().hex, date_start=parent.date_start, date_end=parent.date_end)
    unrelated_child = Event(id=uuid4().hex, title='Other occurrence', parent_event_id=unrelated_parent.id,
                            recurrence_group_id=unrelated_parent.recurrence_group_id,
                            date_start=children[0].date_start, date_end=children[0].date_end)
    session.add_all([unrelated_parent, unrelated_child])
    session.commit()
    rows = [parent, *children, unrelated_parent, unrelated_child]
    snapshot = {row.id: row.model_dump() for row in rows}
    output = []
    counts = inspect_durations(session, **{target: getattr(parent, 'id' if target == 'parent_id' else target)},
                               duration_minutes=150, apply=True, emit=output.append)
    session.commit()
    assert counts.inspected == counts.malformed == counts.repaired == 3
    reports = [json.loads(line) for line in output[:-1]]
    assert reports[0]['role'] == 'parent'
    assert reports[0]['parent_duration_seconds'] == 26620200
    assert reports[0]['existing_end'] == snapshot[parent.id]['date_end'].isoformat()
    assert [report['expected_end'] for report in reports] == [
        '2026-02-25T12:30:00', '2026-03-04T12:30:00', '2026-03-11T12:30:00']
    for row in rows:
        expected = dict(snapshot[row.id])
        if row in [parent, *children]:
            expected['date_end'] = row.date_start + timedelta(minutes=150)
        assert row.model_dump() == expected
    assert inspect_durations(session, parent_id=parent.id, duration_minutes=150,
                             apply=True, emit=lambda _: None).repaired == 0


def test_explicit_duration_dry_run_never_mutates_corrupt_parent_or_children(series):
    session, parent, _ = series
    children = corrupt_parent_and_children(session, parent)
    snapshot = {row.id: row.model_dump() for row in [parent, *children]}
    with patch.object(session, 'flush', side_effect=AssertionError('dry run flushed')):
        counts = inspect_durations(session, parent_id=parent.id, duration_minutes=150, emit=lambda _: None)
    assert (counts.inspected, counts.malformed, counts.repaired) == (3, 3, 0)
    assert not session.dirty
    assert {row.id: row.model_dump() for row in [parent, *children]} == snapshot
    # Without an override the stored (corrupt) parent remains the source of truth.
    assert inspect_durations(session, parent_id=parent.id, apply=True, emit=lambda _: None).repaired == 0
    assert parent.date_end == snapshot[parent.id]['date_end']


@pytest.mark.parametrize('minutes', [360, 3 * 1440 + 150], ids=['overnight', 'multi-day'])
def test_explicit_duration_preserves_overnight_and_multi_day(series, minutes):
    session, parent, _ = series
    parent.date_start = datetime(2026, 2, 25, 20)
    children = corrupt_parent_and_children(session, parent)
    inspect_durations(session, parent_id=parent.id, duration_minutes=minutes, apply=True, emit=lambda _: None)
    session.commit()
    assert all(row.date_end == row.date_start + timedelta(minutes=minutes) for row in [parent, *children])
    assert parent.date_end.date() > parent.date_start.date()


@pytest.mark.parametrize('failure', ['ambiguous-child', 'flush-failure'])
def test_explicit_duration_transaction_rolls_back_parent_and_all_children(series, failure):
    session, parent, _ = series
    children = corrupt_parent_and_children(session, parent)
    if failure == 'ambiguous-child':
        children[-1].recurrence_group_id = uuid4().hex
        session.commit()
    snapshot = {row.id: row.model_dump() for row in [parent, *children]}
    parent_id = parent.id
    session.rollback()
    if failure == 'flush-failure':
        with pytest.raises(RuntimeError, match='simulated write failure'):
            with session.begin():
                with patch.object(session, 'flush', side_effect=RuntimeError('simulated write failure')):
                    inspect_durations(session, parent_id=parent_id, duration_minutes=150, apply=True, emit=lambda _: None)
    else:
        with pytest.raises(ValueError, match='unverifiable'):
            with session.begin():
                inspect_durations(session, parent_id=parent_id, duration_minutes=150, apply=True, emit=lambda _: None)
    assert {row_id: session.get(Event, row_id).model_dump() for row_id in snapshot} == snapshot


@pytest.mark.parametrize('args', [ ['--duration-minutes', '150'],
    ['--parent-id', 'test', '--duration-minutes', '0'],
    ['--parent-id', 'test', '--duration-minutes', '-1']])
def test_duration_override_cli_rejects_unsafe_arguments_before_database(args, capsys):
    with pytest.raises(SystemExit) as error:
        main(args)
    assert error.value.code == 2
    assert 'No database connection or writes were made' in capsys.readouterr().err


def test_duration_override_cannot_be_used_globally(series):
    session, _, _ = series
    with pytest.raises(ValueError, match='requires --parent-id'):
        inspect_durations(session, duration_minutes=150, apply=True)
    with pytest.raises(ValueError, match='requires --parent-id'):
        inspect_durations(session, duration_minutes=150)
