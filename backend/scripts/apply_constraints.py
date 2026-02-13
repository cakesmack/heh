"""
apply_constraints.py
--------------------
One-shot script to add database-level constraints to an existing live database.
SQLModel.metadata.create_all() does NOT alter existing tables, so this script
applies the constraints directly via ALTER TABLE.

Each statement is wrapped in try/except so it is safe to run multiple times
(idempotent — "already exists" errors are silently ignored).

Usage:
    cd backend
    python -m scripts.apply_constraints
"""
import sys
import os

# Ensure the backend package is importable when run from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine

CONSTRAINTS = [
    {
        "description": "Unique constraint on events(title, date_start, venue_id)",
        "sql": "ALTER TABLE events ADD CONSTRAINT uq_event_title_date_venue UNIQUE (title, date_start, venue_id);",
    },
    {
        "description": "Unique constraint on bookmarks(user_id, event_id)",
        "sql": "ALTER TABLE bookmarks ADD CONSTRAINT uq_user_event_bookmark UNIQUE (user_id, event_id);",
    },
]


def apply_constraints():
    print("=" * 60)
    print("  Phase 1 — Apply Database Constraints")
    print("=" * 60)
    print()

    with engine.connect() as conn:
        for item in CONSTRAINTS:
            print(f"  → {item['description']}")
            try:
                conn.execute(text(item["sql"]))
                conn.commit()
                print(f"    ✅ Applied successfully.")
            except Exception as e:
                conn.rollback()
                err = str(e).lower()
                if "already exists" in err or "duplicate" in err:
                    print(f"    ⏭️  Already exists — skipped.")
                else:
                    print(f"    ❌ Failed: {e}")
            print()

    print("=" * 60)
    print("  Done.")
    print("=" * 60)


if __name__ == "__main__":
    apply_constraints()
