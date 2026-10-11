"""Read-only CSV triage of canonical recurring series; never infer durations."""
import argparse
import csv
import os
import sys

from dateutil.rrule import rrulestr
from sqlalchemy.engine import make_url
from sqlmodel import Session, create_engine, select, text

import app.models  # noqa: F401
from app.core.utils import to_london_naive
from app.models.event import Event
from app.scripts.repair_missing_recurrence_rules import restore_missing_rule


FIELDS = ('parent_id', 'title', 'recurrence_group_id', 'parent_start', 'parent_end',
          'stored_duration_minutes', 'recurrence_rule', 'recurrence_end_date', 'child_count',
          'first_child_start', 'last_child_start', 'min_child_duration_minutes',
          'max_child_duration_minutes', 'children_marked_recurring', 'missing_rule',
          'suspicious_duration', 'suggested_action', 'confidence', 'notes')


def maintenance_engine():
    """Use only the supplied environment, without app startup/migrations/secrets."""
    value = os.environ.get('DATABASE_URL')
    if not value:
        raise ValueError('DATABASE_URL must be supplied in the environment')
    url = make_url(value)
    if url.drivername in ('postgres', 'postgresql'):
        url = url.set(drivername='postgresql+psycopg2')
    return create_engine(url, echo=False, pool_pre_ping=True)


def duration_minutes(event):
    if event.date_start is None or event.date_end is None:
        return None
    return (to_london_naive(event.date_end) - to_london_naive(event.date_start)).total_seconds() / 60


def inspect_series(session, parent):
    with session.no_autoflush:
        children = session.exec(select(Event).where(Event.parent_event_id == parent.id)
                                .order_by(Event.date_start, Event.id)).all()
        duration = duration_minutes(parent)
        child_durations = [duration_minutes(child) for child in children]
        known = [value for value in child_durations if value is not None]
        starts = sorted(to_london_naive(child.date_start) for child in children if child.date_start)
        # This threshold is a triage flag, NOT proof that a long event is corrupt.
        suspicious = duration is None or duration <= 0 or duration > 36 * 60 or any(
            value is None or value <= 0 or value > 36 * 60 or value != duration for value in child_durations)
        missing = parent.recurrence_rule is None
        notes = []
        ambiguous = not children or not parent.recurrence_group_id or bool(parent.showtimes) or any(
            child.recurrence_group_id != parent.recurrence_group_id or child.is_recurring
            or child.recurrence_rule or child.showtimes or child.date_start is None for child in children)
        inferred = None
        if missing:
            try:
                inferred = restore_missing_rule(session, parent_id=parent.id, emit=lambda _: None)['inferred_rule']
                notes.append('Safe historical pattern candidate: ' + inferred + '; owner confirmation required')
            except ValueError as error:
                ambiguous = True
                notes.append(str(error))
        elif not parent.recurrence_rule or not parent.date_start:
            ambiguous = True
            notes.append('Empty rule or missing anchor')
        else:
            try:
                rrulestr(parent.recurrence_rule, dtstart=parent.date_start)
            except (ValueError, TypeError, OverflowError):
                ambiguous = True
                notes.append('Stored rule cannot be parsed')
        if suspicious:
            action = 'suspicious duration / manual duration required'
            confidence = 'duration unknown'
            notes.append('Long (>36h), missing, non-positive or differing durations are review flags, not corruption proof. '
                         'No independent trustworthy duration evidence is stored; never infer from time of day or child agreement.')
        elif ambiguous:
            action, confidence = 'ambiguous/manual review', 'insufficient evidence'
        elif missing and inferred:
            action, confidence = 'missing recurrence rule, inference possible', 'consistent observed weekly pattern'
        else:
            action, confidence = 'healthy', 'no audited anomaly; not proof of intended schedule'
        if ambiguous:
            notes.append('Ownership/rule/history needs manual review')
        if not children:
            notes.append('No generated children')
        iso = lambda value: value.isoformat() if value else ''
        return dict(zip(FIELDS, (
            parent.id, parent.title, parent.recurrence_group_id, iso(parent.date_start), iso(parent.date_end),
            duration, parent.recurrence_rule, iso(parent.recurrence_end_date), len(children),
            iso(starts[0]) if starts else '', iso(starts[-1]) if starts else '',
            min(known) if known else None, max(known) if known else None,
            sum(bool(child.is_recurring) for child in children), missing, suspicious,
            action, confidence, ' '.join(notes))))


def write_audit(session, output):
    writer = csv.DictWriter(output, fieldnames=FIELDS)
    writer.writeheader()
    with session.no_autoflush:
        parents = session.exec(select(Event).where(Event.is_recurring == True, Event.parent_event_id == None)
                               .order_by(Event.id)).all()
        for parent in parents:
            writer.writerow(inspect_series(session, parent))
    return len(parents)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', help='CSV path; otherwise CSV goes to stdout')
    args = parser.parse_args(argv)
    engine = None
    try:
        engine = maintenance_engine()
        with Session(engine, autoflush=False) as session:
            with session.begin():
                if engine.dialect.name == 'postgresql':
                    session.exec(text('SET TRANSACTION READ ONLY'))
                if args.output:
                    with open(args.output, 'w', newline='', encoding='utf-8-sig') as output:
                        write_audit(session, output)
                else:
                    write_audit(session, sys.stdout)
    except Exception as error:
        # Do not emit URLs, SQL parameters or driver connection details.
        print('Audit failed (' + type(error).__name__ + '); no data was changed.', file=sys.stderr)
        return 1
    finally:
        if engine is not None:
            engine.dispose()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
