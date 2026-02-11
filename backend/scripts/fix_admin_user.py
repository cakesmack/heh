"""
One-time script to ensure the admin user has is_active = True.
Run on Render Shell or as a release command.

Usage:
    python scripts/fix_admin_user.py
"""
import os
import sys
from sqlalchemy import create_engine, text


def main() -> None:
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("[fix_admin] DATABASE_URL not set — aborting.")
        sys.exit(1)

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(database_url)

    with engine.begin() as conn:
        result = conn.execute(text("""
            UPDATE users
            SET is_active = TRUE
            WHERE is_admin = TRUE AND (is_active = FALSE OR is_active IS NULL)
            RETURNING id, email;
        """))
        rows = result.fetchall()

        if rows:
            for row in rows:
                print(f"[fix_admin] Activated admin: {row[1]} (id={row[0]})")
        else:
            print("[fix_admin] All admin users already active — nothing to do.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[fix_admin] FATAL: {exc}")
        sys.exit(1)
