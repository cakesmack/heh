"""Append ongoing recurring dates to a rolling 180-day horizon."""
import logging

from sqlmodel import Session, select

from app.models.event import Event
from app.services.recurrence import is_ongoing_recurring, replenish_recurring_parent

logger = logging.getLogger(__name__)


def run_replenishment(engine, *, summary: dict[str, int] | None = None) -> list[str]:
    # Optional reporting only; keep the existing failed-ID return contract.
    summary = summary if summary is not None else {}
    summary.update(series_processed=0, occurrences_created=0, skipped=0, failures=0)
    with Session(engine) as session:
        parents = session.exec(select(Event).where(Event.is_recurring == True, Event.parent_event_id == None)).all()
        parent_ids = [parent.id for parent in parents if is_ongoing_recurring(parent)]
        summary["skipped"] = len(parents) - len(parent_ids)
    failed = []
    for parent_id in parent_ids:
        summary["series_processed"] += 1
        try:
            with Session(engine) as session:
                created = replenish_recurring_parent(session, parent_id)
                session.commit()
                summary["occurrences_created"] += len(created)
                summary["skipped"] += int(not created)
                logger.info("Replenished event_id=%s occurrences=%s", parent_id, len(created))
        except Exception:
            failed.append(parent_id)
            summary["failures"] += 1
            logger.exception("Recurrence replenishment failed event_id=%s", parent_id)
    return failed


def main() -> int:
    from app.core.database import engine
    logging.basicConfig(level=logging.INFO)
    return 1 if run_replenishment(engine) else 0


if __name__ == "__main__":
    raise SystemExit(main())
