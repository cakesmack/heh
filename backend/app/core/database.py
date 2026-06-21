"""
Database connection and session management.
Handles SQLModel engine creation and session lifecycle.
"""
import logging
import os
from typing import Generator
from sqlalchemy.exc import OperationalError
from sqlmodel import SQLModel, create_engine, Session, text
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from .config import settings

logger = logging.getLogger(__name__)

# 1. DATABASE URL
# Ensure we use the correct URL from settings
DATABASE_URL = settings.DATABASE_URL

# 2. THE ENGINE (Performance Optimized)
# - pool_pre_ping=True: Auto-heals broken connections
# - pool_size=50: High-concurrency support
# - max_overflow=50: Additional capacity for traffic spikes
# - pool_timeout=30: Wait up to 30s for a session before erroring
# - pool_recycle=1800: Refreshes connections every 30 mins
engine = create_engine(
    DATABASE_URL,
    echo=False, 
    pool_pre_ping=True, 
    pool_size=50, 
    max_overflow=50, 
    pool_timeout=30,
    pool_recycle=1800
)

def run_migrations():
    """Run any pending database migrations."""
    # 1. Run SQL migrations from migrations/ folder
    try:
        from scripts.run_migrations import run_migrations as run_sql_migrations
        logger.info("Running SQL schema migrations...")
        run_sql_migrations()
        logger.info("✅ SQL schema migrations complete")
    except Exception as e:
        logger.error(f"Failed to run SQL migrations: {e}")

    # 2. Run inline migrations
    with Session(engine) as session:
        if "sqlite" in settings.DATABASE_URL:
            logger.info("Skipping Postgres-only migrations for SQLite")
            return

        # Add is_active column to users table if it doesn't exist
        try:
            session.execute(text("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL
            """))
            session.commit()
            logger.info("✅ Database migration: is_active column ensured on users table")
        except Exception as e:
            session.rollback()
            logger.warning(f"Migration note: {e}")
        
        # Set banned@test.com to is_active=FALSE
        try:
            session.execute(text("""
                UPDATE users SET is_active = FALSE WHERE email = 'banned@test.com'
            """))
            session.commit()
            logger.info("✅ Database migration: banned@test.com set to inactive")
        except Exception as e:
            session.rollback()
            logger.warning(f"Migration note: {e}")

    # 3. Seed slot pricing defaults
    try:
        from app.scripts.migrate_slot_pricing import run_migration as run_pricing_seeding
        logger.info("Running slot pricing seeding...")
        run_pricing_seeding()
        logger.info("✅ Slot pricing seeding complete")
    except Exception as e:
        logger.error(f"Failed to seed slot pricing: {e}")

def create_db_and_tables():
    """Create all database tables defined in SQLModel models."""
    SQLModel.metadata.create_all(engine)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(OperationalError),
    before_sleep=lambda retry_state: logger.warning(
        f"Database connection failed, retrying in {retry_state.next_action.sleep} seconds..."
    ),
)
def check_db_connection() -> bool:
    """
    Check database connectivity with retry logic.
    Useful for health checks and cold-start scenarios.
    """
    with Session(engine) as session:
        session.execute(text("SELECT 1"))
    return True

def get_session() -> Generator[Session, None, None]:
    """
    Dependency function that yields a database session.
    Used with FastAPI's Depends() for automatic session management.
    """
    with Session(engine) as session:
        yield session
