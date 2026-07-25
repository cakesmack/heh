import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, create_engine, pool
from alembic import context
from sqlmodel import SQLModel

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import all app models so SQLModel.metadata is fully populated
import app.models  # noqa: F401
from app.core.config import settings

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target_metadata to SQLModel.metadata
target_metadata = SQLModel.metadata

def include_object(object, name, type_, reflected, compare_to):
    """
    Filter out database objects not managed by SQLModel.
    Prevents Alembic from generating destructive ops for unmanaged tables
    like 'checkins', 'schema_migrations', etc.
    """
    if type_ == "table" and reflected and name not in target_metadata.tables:
        return False
    return True

def get_url() -> str:
    """Dynamically retrieve database URL from environment variables or settings."""
    db_url = os.getenv("DATABASE_URL") or str(settings.DATABASE_URL)
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    return db_url

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = create_engine(
        get_url(),
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
