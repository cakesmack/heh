"""Owner-reviewed CSV repairs, dry-run by default, one transaction per parent."""
import argparse
import csv
import json
from datetime import timedelta
from uuid import UUID

from sqlmodel import Session, select

from app.core.utils import to_london_naive
from app.models.event import Event
from app.scripts.audit_recurring_series import inspect_series, maintenance_engine
from app.scripts.repair_missing_recurrence_rules import restore_missing_rule
from app.scripts.repair_recurring_occurrence_durations import inspect_durations
from app.services.recurrence import is_ongoing_recurring, replenish_recurring_parent


FIELDS = ('parent_id', 'intended_duration_minutes', 'repair_rule', 'replenish')


def read_manifest(source):
    reader = csv.DictReader(source)
    if reader.fieldnames is None or len(reader.fieldnames) != len(FIELDS) or set(reader.fieldnames) != set(FIELDS):
        raise ValueError('Manifest must have exactly these headers: ' + ','.join(FIELDS))
    rows, seen = [], set()
    for line, row in enumerate(reader, 2):
        if None in row or any(value is None for value in row.values()):
            raise ValueError(f'Invalid column count at line {line}')
        try:
            parent_id = UUID(row['parent_id'].strip()).hex
            value = row['intended_duration_minutes'].strip()
            minutes = int(value) if value else None
            if minutes is not None and minutes <= 0:
                raise ValueError()
            flags = [row[key].strip().lower() for key in ('repair_rule', 'replenish')]
            if any(flag not in ('true', 'false') for flag in flags):
                raise ValueError()
        except ValueError:
            raise ValueError(f'Invalid UUID, positive whole-minute duration or true/false flags at line {line}') from None
        if parent_id in seen:
            raise ValueError(f'Duplicate parent at line {line}; refusing the whole manifest')
        seen.add(parent_id)
        rows.append(dict(parent_id=parent_id, intended_duration_minutes=minutes,
                         repair_rule=flags[0] == 'true', replenish=flags[1] == 'true'))
    if not rows:
        raise ValueError('Empty manifest; explicit parent rows are required')
    return rows


def process_series(session, row, *, apply=False, now=None):
    query = select(Event).where(Event.id == row['parent_id'])
    if apply:
        query = query.with_for_update()
    parent = session.exec(query).first()
    if parent is None or parent.parent_event_id or not parent.is_recurring:
        raise ValueError('Target must be a canonical recurring parent')
    audit = inspect_series(session, parent)
    minutes = row['intended_duration_minutes']
    if audit['suspicious_duration'] and minutes is None and (row['repair_rule'] or row['replenish']):
        raise ValueError('Suspicious duration / manual duration required before repair or replenishment')
    result = dict(parent_id=parent.id, dry_run=not apply, duration_changes=[], rule_repair=None, occurrences=[])
    # Validate all requested repairs before applying either. Failure rolls back
    # even if replenishment fails after repairs have flushed.
    if minutes is not None:
        counts = inspect_durations(session, parent_id=parent.id, duration_minutes=minutes,
                                   emit=lambda value: result['duration_changes'].append(json.loads(value)), emit_summary=False)
        if counts.unverifiable:
            raise ValueError('Unverifiable duration/ownership; series refused')
    inferred = None
    if row['repair_rule']:
        if parent.recurrence_rule is None:
            inferred = restore_missing_rule(session, parent_id=parent.id, emit=lambda _: None)
            result['rule_repair'] = inferred
        else:
            result['rule_repair'] = {'existing_rule': parent.recurrence_rule, 'action': 'already present; left unchanged'}
    if row['replenish']:
        if not is_ongoing_recurring(parent):
            raise ValueError('Parent is finite/cancelled; ongoing replenishment is not supported')
        if not parent.recurrence_rule and inferred is None:
            raise ValueError('Replenishment requires a valid existing rule or successful requested inference')
        if audit['children_marked_recurring'] or 'Ownership/rule/history needs manual review' in audit['notes']:
            raise ValueError('Ambiguous ownership/history; replenishment refused')
    if apply:
        if minutes is not None:
            inspect_durations(session, parent_id=parent.id, duration_minutes=minutes, apply=True, emit=lambda _: None)
        if inferred is not None:
            restore_missing_rule(session, parent_id=parent.id, apply=True, emit=lambda _: None)
    if row['replenish']:
        proposed = replenish_recurring_parent(session, parent.id, now=now, dry_run=not apply,
                                             preview_rule=inferred['inferred_rule'] if inferred and not apply else None)
        for child in proposed:
            end = to_london_naive(child.date_start) + timedelta(minutes=minutes) if minutes is not None else child.date_end
            result['occurrences'].append({'date_start': child.date_start.isoformat(), 'date_end': end.isoformat()})
    result['occurrence_count'] = len(result['occurrences'])
    return result


def run_manifest(engine, rows, *, apply=False, now=None, emit=print):
    summary = dict(dry_run=not apply, selected=len(rows), succeeded=0, failed=0)
    for row in rows:
        try:
            with Session(engine, autoflush=False) as session:
                with session.begin():
                    report = process_series(session, row, apply=apply, now=now)
            report['status'] = 'applied' if apply else 'dry-run'
            summary['succeeded'] += 1
        except Exception as error:
            # Validation messages are controlled; database errors can expose
            # connection/SQL details, so only emit their class, never their text.
            message = str(error) if type(error) is ValueError else type(error).__name__
            report = dict(parent_id=row['parent_id'], status='failed; rolled back', error=message)
            summary['failed'] += 1
        emit(json.dumps(report))
    emit(json.dumps({'summary': summary}))
    return summary


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', help='CSV containing explicit canonical parent UUIDs')
    parser.add_argument('--apply', action='store_true', help='Apply only these reviewed manifest rows')
    args = parser.parse_args(argv)
    engine = None
    try:
        with open(args.manifest, newline='', encoding='utf-8-sig') as source:
            rows = read_manifest(source)
        engine = maintenance_engine()
        summary = run_manifest(engine, rows, apply=args.apply)
        return 1 if summary['failed'] else 0
    except Exception as error:
        print(json.dumps({'error': str(error) if type(error) is ValueError else type(error).__name__, 'applied': False}))
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == '__main__':
    raise SystemExit(main())
