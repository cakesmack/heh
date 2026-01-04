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

# Determine which database URL to use
# Prefer pooler URL for production (Render), fallback to direct URL
database_url = settings.DATABASE_URL_POOLER or settings.DATABASE_URL

# SQLite doesn't support pooling options
is_sqlite = database_url.startswith("sqlite")

# Warn if SQLite is used in production-like environment
if is_sqlite and os.getenv("RENDER", ""):
    logger.warning(
        "⚠️  SQLite detected in production environment! "
        "This will cause data loss on container restart. "
        "Set DATABASE_URL to a PostgreSQL connection string."
    )

# Create database engine with appropriate options
if is_sqlite:
    engine = create_engine(
        database_url,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        database_url,
        echo=settings.DEBUG,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=5,
        max_overflow=10,
    )


def run_migrations():
    """Run any pending database migrations."""
    if is_sqlite:
        return  # Skip migrations for SQLite
    
    with Session(engine) as session:
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


# Run migrations IMMEDIATELY at import time (before any requests)
# This ensures the database schema is ready before FastAPI starts accepting requests
run_migrations()


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

    Usage:
        @app.get("/items")
        def get_items(session: Session = Depends(get_session)):
            ...
    """
    with Session(engine) as session:
        yield session
