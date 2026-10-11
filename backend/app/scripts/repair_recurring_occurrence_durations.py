"""Diagnose duration mismatches; repair only an explicitly confirmed broken series.

Children can be edited independently and no generation-duration snapshot or
exception marker is stored. A mismatch against today's parent is therefore a
review candidate, NOT proof of corruption. --apply requires one explicit series
target and is the owner's confirmation that its mismatches should be repaired.
"""
import argparse
import json
from dataclasses import asdict, dataclass

from sqlmodel import Session, select

from app.core.utils import normalize_uuid, to_london_naive
from app.models.event import Event


@dataclass
class InspectionCounts:
    inspected: int = 0
    malformed: int = 0  # Duration mismatches requiring review, not certified corruption.
    unverifiable: int = 0
    repaired: int = 0


def canonical_parent(session, child):
    seen = {child.id}
    parent_id = child.parent_event_id
    while parent_id:
        if parent_id in seen:
            return None, "cyclic parent relationship"
        seen.add(parent_id)
        parent = session.get(Event, parent_id)
        if parent is None:
            return None, "missing parent"
        if not parent.parent_event_id:
            return parent, None
        parent_id = parent.parent_event_id
    return None, "missing canonical parent"


def inspect_durations(session, *, parent_id=None, recurrence_group_id=None, apply=False, emit=print, emit_summary=True):
    counts = InspectionCounts()
    query = select(Event).where(Event.parent_event_id != None).order_by(Event.parent_event_id, Event.date_start, Event.id)
    if apply and not (parent_id or recurrence_group_id):
        raise ValueError('--apply requires --parent-id or --recurrence-group-id; global automatic repair is forbidden')
    target = None
    if parent_id or recurrence_group_id:
        parents = select(Event).where(Event.parent_event_id == None)
        parents = parents.where(Event.id == parent_id) if parent_id else parents.where(Event.recurrence_group_id == recurrence_group_id)
        if apply:
            parents = parents.with_for_update()
        with session.no_autoflush:
            found = session.exec(parents).all()
        if len(found) != 1 or not found[0].is_recurring:
            raise ValueError('Target must identify exactly one canonical recurring parent; use --parent-id to disambiguate')
        target = found[0]
        query = query.where(Event.parent_event_id == target.id)
    if apply:
        query = query.with_for_update()
    plans = []
    # Explicitly disable autoflush even when called with a caller-owned session.
    with session.no_autoflush:
        for child in session.exec(query).all():
            parent, problem = canonical_parent(session, child)
            if target:
                parent, problem = target, None
            counts.inspected += 1
            if parent is not None:
                if not parent.is_recurring:
                    problem = "canonical parent no longer recurring; original duration unknown"
                elif child.recurrence_group_id != parent.recurrence_group_id:
                    problem = "parent/group relationship mismatch"
                elif child.is_recurring or child.recurrence_rule or child.showtimes:
                    problem = "child owns recurrence/showtimes; not a simple generated occurrence"
                elif parent.date_start is None or parent.date_end is None or child.date_start is None:
                    problem = "missing schedule value"
            expected = None
            if not problem:
                duration = to_london_naive(parent.date_end) - to_london_naive(parent.date_start)
                if duration.total_seconds() < 0:
                    problem = "negative parent duration"
                else:
                    expected = to_london_naive(child.date_start) + duration
            if problem:
                counts.unverifiable += 1
            elif to_london_naive(child.date_end) != expected:
                counts.malformed += 1
                problem = "duration mismatch; intentional edit or previous parent duration cannot be excluded"
                plans.append((child, expected))
            emit(json.dumps({
                "series_event_id": parent.id if parent else child.parent_event_id,
                "recurrence_group_id": child.recurrence_group_id,
                "child_id": child.id,
                "existing_start": child.date_start.isoformat() if child.date_start else None,
                "existing_end": child.date_end.isoformat() if child.date_end else None,
                "expected_end": expected.isoformat() if expected else None,
                "parent_duration_seconds": duration.total_seconds() if expected else None,
                "child_duration_seconds": (to_london_naive(child.date_end) - to_london_naive(child.date_start)).total_seconds() if child.date_start and child.date_end else None,
                "reason": problem,
                "automatic_repair_safe": False,
                "targeted_repair_confirmed": apply,
            }))
    if apply:
        if counts.unverifiable:
            raise ValueError('Target contains unverifiable children; refusing the entire series repair')
        # Validate every row before changing anything. Caller owns commit/rollback.
        for child, expected in plans:
            child.date_end = expected
        session.flush()
        counts.repaired = len(plans)
    if emit_summary:
        emit(json.dumps({"dry_run": not apply, "summary": asdict(counts)}))
    return counts


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Confirm that duration mismatches in the explicitly targeted series are corrupt and repair only their end dates.")
    targets = parser.add_mutually_exclusive_group()
    targets.add_argument("--parent-id", help="Canonical parent Event ID.")
    targets.add_argument("--recurrence-group-id", help="Group ID identifying exactly one canonical recurring parent.")
    args = parser.parse_args(argv)
    if args.apply and not (args.parent_id or args.recurrence_group_id):
        parser.error("--apply requires --parent-id or --recurrence-group-id. No database connection or writes were made.")
    # Register all existing model relationships before opening the session.
    import app.models  # noqa: F401
    from app.core.database import engine
    with Session(engine, autoflush=False) as session:
        with session.begin():
            counts = inspect_durations(session,
                parent_id=normalize_uuid(args.parent_id) if args.parent_id else None,
                recurrence_group_id=normalize_uuid(args.recurrence_group_id) if args.recurrence_group_id else None,
                apply=args.apply, emit_summary=False)
        print(json.dumps({"dry_run": not args.apply, "summary": asdict(counts)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
