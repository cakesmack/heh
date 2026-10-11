"""Restore a missing rule for one owner-selected, consistently spaced series.

Dry-run is the default. Only weekly/fortnightly, single-weekday patterns with at
least three generated children are supported. Historical regularity cannot prove
future intent: --apply confirms the owner has reviewed the inferred rule.
"""
import argparse
import json
from datetime import timedelta

from sqlmodel import Session, select

from app.core.utils import normalize_uuid, to_london_naive
from app.models.event import Event
from app.services.recurrence import is_ongoing_recurring, replenish_recurring_parent


def restore_missing_rule(session, *, parent_id, apply=False, preview_next=False, now=None, emit=print):
    if not parent_id:
        raise ValueError('An explicit --parent-id is required')
    with session.no_autoflush:
        query = select(Event).where(Event.id == parent_id)
        if apply:
            query = query.with_for_update()
        parent = session.exec(query).first()
        if parent is None or parent.parent_event_id or not parent.is_recurring:
            raise ValueError('Target must be a canonical recurring parent')
        if parent.recurrence_rule is not None:
            raise ValueError('Target already has a recurrence rule; refusing to overwrite it')
        if parent.showtimes or not parent.date_start or not parent.recurrence_group_id:
            raise ValueError('Parent schedule/group is ambiguous')
        query = select(Event).where(Event.parent_event_id == parent.id).order_by(Event.date_start, Event.id)
        if apply:
            query = query.with_for_update()
        children = session.exec(query).all()
        if len(children) < 3:
            raise ValueError('Too few generated children: at least three are required')
        if any(not child.date_start or child.is_recurring or child.recurrence_rule or child.showtimes
               or child.recurrence_group_id != parent.recurrence_group_id for child in children):
            raise ValueError('Generated child ownership/schedule is ambiguous')
        starts = [to_london_naive(parent.date_start), *[to_london_naive(child.date_start) for child in children]]
        intervals = {later - earlier for earlier, later in zip(starts, starts[1:])}
        if len(intervals) != 1 or next(iter(intervals)) not in (timedelta(days=7), timedelta(days=14)):
            raise ValueError('Inconsistent or unsupported intervals; monthly/custom patterns cannot be safely inferred')
        if any(start.weekday() != starts[0].weekday() or start.time() != starts[0].time() for start in starts):
            raise ValueError('Occurrence weekdays/times are inconsistent')
        interval = next(iter(intervals)).days // 7
        weekday = ('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU')[starts[0].weekday()]
        rule = 'FREQ=WEEKLY' + (';INTERVAL=2' if interval == 2 else '') + ';BYDAY=' + weekday
        report = {
            'parent_id': parent.id, 'dry_run': not apply,
            'existing_rule': parent.recurrence_rule, 'inferred_rule': rule,
            'generated_children_inspected': len(children),
            'recurrence_end_date': parent.recurrence_end_date.isoformat() if parent.recurrence_end_date else None,
            'ongoing_replenishment_eligible': is_ongoing_recurring(parent),
        }
        if preview_next:
            # The real service supplies its current time, latest-child boundary,
            # horizon and duplicate handling. Preview instances remain transient.
            proposed = replenish_recurring_parent(session, parent.id, now=now, dry_run=True, preview_rule=rule)
            report['would_generate'] = [
                {'date_start': child.date_start.isoformat(), 'date_end': child.date_end.isoformat()}
                for child in proposed
            ]
        if apply:
            parent.recurrence_rule = rule
            session.flush()
        emit(json.dumps(report))
        return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--parent-id', required=True, help='Canonical recurring parent ID')
    parser.add_argument('--apply', action='store_true', help='Confirm the inferred rule and restore only recurrence_rule')
    parser.add_argument('--preview-next', action='store_true', help='Show the current replenishment service\'s next occurrences without saving any')
    args = parser.parse_args(argv)
    import app.models  # noqa: F401
    from app.core.database import engine
    try:
        with Session(engine, autoflush=False) as session:
            with session.begin():
                report = restore_missing_rule(session, parent_id=normalize_uuid(args.parent_id),
                                              apply=args.apply, preview_next=args.preview_next, emit=lambda _: None)
        # Report success only after the transaction commits.
        print(json.dumps(report))
    except ValueError as error:
        print(json.dumps({'error': str(error), 'applied': False}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
