"""Render cron entrypoint; run from backend with python scripts/replenish_recurring_events.py."""
import logging
from pathlib import Path
import sys


def main() -> int:
    # Script execution adds scripts/, rather than backend/, to Python's path.
    backend_root = str(Path(__file__).resolve().parents[1])
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)
    logging.basicConfig(level=logging.INFO)
    summary = dict(series_processed=0, occurrences_created=0, skipped=0, failures=0)
    try:
        from app.core.database import engine
        from app.scripts.replenish_recurring_events import run_replenishment
        failed = run_replenishment(engine, summary=summary)
        return 1 if failed else 0
    except Exception as exc:
        summary["failures"] += 1
        # Configuration/database errors may contain credentials: report type only.
        print(f"Replenishment could not complete ({type(exc).__name__}).", file=sys.stderr)
        return 1
    finally:
        print("Replenishment: " + " ".join(f"{key}={value}" for key, value in summary.items()), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
