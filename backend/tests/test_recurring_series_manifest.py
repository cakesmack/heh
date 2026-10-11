import csv
import io
import json
import os
from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app.models.event import Event
from app.scripts.audit_recurring_series import inspect_series, maintenance_engine, write_audit
from app.scripts.repair_recurring_series_manifest import read_manifest, run_manifest


@pytest.fixture
def database():
    engine = create_engine('sqlite:///:memory:')
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


def add_series(engine, *, rule=None, corrupt=False, irregular=False, title='Wednesday Social'):
    with Session(engine) as session:
        start = datetime(2026, 2, 25, 10)
        end = start + timedelta(minutes=150, days=308 if corrupt else 0)
        parent = Event(id=uuid4().hex, title=title, is_recurring=True,
                       recurrence_group_id=uuid4().hex, recurrence_rule=rule,
                       date_start=start, date_end=end)
        children = [Event(id=uuid4().hex, title=title, parent_event_id=parent.id,
                          recurrence_group_id=parent.recurrence_group_id,
                          date_start=start + timedelta(weeks=week),
                          date_end=end + timedelta(weeks=week)) for week in range(1, 4)]
        if irregular:
            children[-1].date_start += timedelta(days=1)
            children[-1].date_end += timedelta(days=1)
        session.add_all([parent, *children])
        session.commit()
        return parent.id


def snapshot(engine):
    with Session(engine) as session:
        return {row.id: row.model_dump() for row in session.exec(select(Event)).all()}


def manifest(*rows):
    return read_manifest(io.StringIO('parent_id,intended_duration_minutes,repair_rule,replenish\n' + '\n'.join(rows)))


def test_read_only_audit_classifies_and_exports_without_guessing(database):
    healthy = add_series(database, rule='FREQ=WEEKLY;BYDAY=WE')
    missing = add_series(database)
    whisky = add_series(database, corrupt=True, title='Whisky Gigs')
    ambiguous = add_series(database, irregular=True)
    before = snapshot(database)
    with Session(database, autoflush=False) as session:
        with patch.object(session, 'flush', side_effect=AssertionError('audit wrote')):
            output = io.StringIO()
            assert write_audit(session, output) == 4
            reports = {row['parent_id']: row for row in csv.DictReader(io.StringIO(output.getvalue()))}
    assert reports[healthy]['suggested_action'] == 'healthy'
    assert reports[missing]['suggested_action'] == 'missing recurrence rule, inference possible'
    assert 'FREQ=WEEKLY;BYDAY=WE' in reports[missing]['notes']
    assert reports[whisky]['suggested_action'] == 'suspicious duration / manual duration required'
    assert reports[whisky]['confidence'] == 'duration unknown'
    assert float(reports[whisky]['stored_duration_minutes']) == 308 * 1440 + 150
    assert reports[ambiguous]['suggested_action'] == 'ambiguous/manual review'
    assert reports[healthy]['child_count'] == '3'
    assert snapshot(database) == before


def test_manifest_dry_run_previews_all_repairs_without_any_write(database):
    parent_id = add_series(database, corrupt=True)
    before = snapshot(database)
    reports = []
    with patch.object(Session, 'flush', side_effect=AssertionError('dry run wrote')):
        summary = run_manifest(database, manifest(f'{parent_id},150,true,true'),
                               now=datetime(2026, 3, 20), emit=reports.append)
    report = json.loads(reports[0])
    assert summary == dict(dry_run=True, selected=1, succeeded=1, failed=0)
    assert report['rule_repair']['inferred_rule'] == 'FREQ=WEEKLY;BYDAY=WE'
    assert len(report['duration_changes']) == 4
    assert report['occurrences'][0] == dict(date_start='2026-03-25T10:00:00', date_end='2026-03-25T12:30:00')
    assert snapshot(database) == before


def test_mixed_apply_preserves_blank_duration_and_unlisted_series(database):
    broken = add_series(database, corrupt=True)
    missing = add_series(database)
    healthy = add_series(database, rule='FREQ=WEEKLY;BYDAY=WE')
    other = add_series(database, corrupt=True)
    before = snapshot(database)
    summary = run_manifest(database, manifest(f'{broken},150,true,true', f'{missing},,true,false',
                                              f'{healthy},,false,false'),
                           apply=True, now=datetime(2026, 3, 20), emit=lambda _: None)
    assert summary['succeeded'] == 3 and summary['failed'] == 0
    after = snapshot(database)
    for row_id, original in before.items():
        expected = dict(original)
        if row_id == broken or original['parent_event_id'] == broken:
            expected['date_end'] = original['date_start'] + timedelta(minutes=150)
        if row_id in (broken, missing):
            expected['recurrence_rule'] = 'FREQ=WEEKLY;BYDAY=WE'
        assert after[row_id] == expected
    assert after[other] == before[other]
    assert len(after) > len(before)  # Only the explicit replenish row generated children.


def test_unknown_duration_and_ambiguous_rule_rows_are_refused(database):
    whisky = add_series(database, corrupt=True, title='Whisky Gigs')
    ambiguous = add_series(database, irregular=True)
    before = snapshot(database)
    summary = run_manifest(database, manifest(f'{whisky},,true,true', f'{ambiguous},150,true,false'),
                           apply=True, emit=lambda _: None)
    assert summary['failed'] == 2 and snapshot(database) == before


def test_failure_after_repairs_rolls_back_only_that_series(database):
    failed = add_series(database, corrupt=True)
    successful = add_series(database)
    before = snapshot(database)
    with patch('app.scripts.repair_recurring_series_manifest.replenish_recurring_parent',
               side_effect=RuntimeError('simulated generation failure')):
        summary = run_manifest(database, manifest(f'{failed},150,true,true', f'{successful},,true,false'),
                               apply=True, emit=lambda _: None)
    assert (summary['failed'], summary['succeeded']) == (1, 1)
    after = snapshot(database)
    for row_id, original in before.items():
        expected = dict(original)
        if row_id == successful:
            expected['recurrence_rule'] = 'FREQ=WEEKLY;BYDAY=WE'
        assert after[row_id] == expected


@pytest.mark.parametrize('body', ['*,150,true,true', 'all,150,true,true',
                                 '00000000000000000000000000000001,0,true,false',
                                 '00000000000000000000000000000001,,yes,false',
                                 '00000000000000000000000000000001,,true,false\n00000000000000000000000000000001,,false,false', ''])
def test_invalid_or_global_manifest_is_rejected(body):
    with pytest.raises(ValueError):
        manifest(body)


def test_database_url_is_environment_driven_without_printing_credentials(capsys):
    with patch.dict(os.environ, {'DATABASE_URL': 'postgresql://owner:private-password@host.example/database'}):
        with patch('app.scripts.audit_recurring_series.create_engine') as create:
            maintenance_engine()
    url = create.call_args.args[0]
    assert url.drivername == 'postgresql+psycopg2' and url.host == 'host.example'
    assert capsys.readouterr().out == ''
