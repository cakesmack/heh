"""Diagnose duration mismatches; repair only an explicitly confirmed broken series.

Children can be edited independently and no generation-duration snapshot or
exception marker is stored. A mismatch against today's parent is therefore a
review candidate, NOT proof of corruption. --apply requires one explicit series
target and is the owner's confirmation that its mismatches should be repaired.
With --duration-minutes, inspect/repair the selected parent as well as its children
using start + supplied duration, never an inferred time-of-day duration. Counts
include the parent only when this override is supplied. Without it the parent's
end is never modified. The CLI owns one transaction for the whole series.
"""
import argparse
import json
from dataclasses import asdict, dataclass
from datetime import timedelta

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


def inspect_durations(session, *, parent_id=None, recurrence_group_id=None, duration_minutes=None, apply=False, emit=print, emit_summary=True):
    counts = InspectionCounts()
    query = select(Event).where(Event.parent_event_id != None).order_by(Event.parent_event_id, Event.date_start, Event.id)
    if apply and not (parent_id or recurrence_group_id):
        raise ValueError('--apply requires --parent-id or --recurrence-group-id; global automatic repair is forbidden')
    supplied_duration = None
    if duration_minutes is not None:
        if not (parent_id or recurrence_group_id):
            raise ValueError('--duration-minutes requires --parent-id or --recurrence-group-id')
        if isinstance(duration_minutes, bool) or not isinstance(duration_minutes, int) or duration_minutes <= 0:
            raise ValueError('--duration-minutes must be a positive integer')
        supplied_duration = timedelta(minutes=duration_minutes)
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
        children = session.exec(query).all()
        # Include the parent only with an explicitly supplied intended duration.
        # Build all plans before mutating it, so child diagnostics retain the old duration.
        rows = ([target] if supplied_duration is not None else []) + list(children)
        for child in rows:
            is_parent = child is target
            parent, problem = (target, None) if is_parent else canonical_parent(session, child)
            if target is not None:
                parent, problem = target, None
            counts.inspected += 1
            if parent is not None:
                if not parent.is_recurring:
                    problem = "canonical parent no longer recurring; original duration unknown"
                elif child.recurrence_group_id != parent.recurrence_group_id:
                    problem = "parent/group relationship mismatch"
                elif parent.showtimes:
                    problem = "canonical parent owns showtimes; ambiguous recurrence schedule"
                elif not is_parent and (child.is_recurring or child.recurrence_rule or child.showtimes):
                    problem = "child owns recurrence/showtimes; not a simple generated occurrence"
                elif parent.date_start is None or child.date_start is None or (parent.date_end is None and supplied_duration is None):
                    problem = "missing schedule value"
            expected = None
            parent_duration = (to_london_naive(parent.date_end) - to_london_naive(parent.date_start)) if parent is not None and parent.date_start and parent.date_end else None
            duration = supplied_duration if supplied_duration is not None else parent_duration
            if not problem:
                if duration.total_seconds() < 0:
                    problem = "negative parent duration"
                else:
                    expected = to_london_naive(child.date_start) + duration
            if problem:
                counts.unverifiable += 1
            elif to_london_naive(child.date_end) != expected:
                counts.malformed += 1
                problem = "differs from explicitly supplied duration" if supplied_duration is not None else "duration mismatch; intentional edit or previous parent duration cannot be excluded"
                plans.append((child, expected))
            emit(json.dumps({
                "series_event_id": parent.id if parent else child.parent_event_id,
                "recurrence_group_id": child.recurrence_group_id,
                "role": "parent" if is_parent else "child",
                "event_id": child.id,
                "child_id": None if is_parent else child.id,
                "existing_start": child.date_start.isoformat() if child.date_start else None,
                "existing_end": child.date_end.isoformat() if child.date_end else None,
                "expected_end": expected.isoformat() if expected else None,
                "parent_duration_seconds": parent_duration.total_seconds() if parent_duration is not None else None,
                "intended_duration_seconds": duration.total_seconds() if expected else None,
                "child_duration_seconds": (to_london_naive(child.date_end) - to_london_naive(child.date_start)).total_seconds() if child.date_start and child.date_end else None,
                "reason": problem,
                "automatic_repair_safe": False,
                "targeted_repair_confirmed": apply,
            }))
    if apply:
        if counts.unverifiable:
            raise ValueError('Target contains unverifiable schedule/children; refusing the entire series repair')
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
    parser.add_argument("--duration-minutes", type=int, help="Explicit intended occurrence duration; also repairs the selected canonical parent end. Requires a target, including for dry-run.")
    args = parser.parse_args(argv)
    if args.apply and not (args.parent_id or args.recurrence_group_id):
        parser.error("--apply requires --parent-id or --recurrence-group-id. No database connection or writes were made.")
    if args.duration_minutes is not None:
        if not (args.parent_id or args.recurrence_group_id) or args.duration_minutes <= 0:
            parser.error("--duration-minutes requires an explicit target and a positive integer. No database connection or writes were made.")
    # Register all existing model relationships before opening the session.
    import app.models  # noqa: F401
    from app.core.database import engine
    with Session(engine, autoflush=False) as session:
        with session.begin():
            counts = inspect_durations(session,
                parent_id=normalize_uuid(args.parent_id) if args.parent_id else None,
                recurrence_group_id=normalize_uuid(args.recurrence_group_id) if args.recurrence_group_id else None,
                duration_minutes=args.duration_minutes, apply=args.apply, emit_summary=False)
        print(json.dumps({"dry_run": not args.apply, "summary": asdict(counts)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
