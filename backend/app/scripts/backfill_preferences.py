"""
Backfill script to create UserPreferences for existing users.
Run once after deploying the UserPreferences model.

Usage: cd backend && python -m app.scripts.backfill_preferences
"""
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlmodel import Session, select
from app.core.database import engine
from app.models.user import User
from app.models.user_preferences import UserPreferences


def backfill_preferences():
    """Create UserPreferences for all users who don't have one."""
    with Session(engine) as session:
        # Find users without preferences
        users_without_prefs = session.exec(
            select(User).where(
                ~User.id.in_(
                    select(UserPreferences.user_id)
                )
            )
        ).all()

        print(f"Found {len(users_without_prefs)} users without preferences")

        created = 0
        for user in users_without_prefs:
            preferences = UserPreferences(user_id=user.id)
            session.add(preferences)
            created += 1

            if created % 100 == 0:
                session.commit()
                print(f"Created {created} preferences...")

        session.commit()
        print(f"Done! Created {created} user preferences.")


if __name__ == "__main__":
    backfill_preferences()
