"""
Database connection and session management.
Handles SQLModel engine creation and session lifecycle.
"""
from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
from .config import settings


# Determine which database URL to use
# Prefer pooler URL for production (Render), fallback to direct URL
database_url = settings.DATABASE_URL_POOLER or settings.DATABASE_URL

# SQLite doesn't support pooling options
is_sqlite = database_url.startswith("sqlite")

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


def create_db_and_tables():
    """Create all database tables defined in SQLModel models."""
    SQLModel.metadata.create_all(engine)


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
