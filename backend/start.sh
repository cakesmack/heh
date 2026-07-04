#!/bin/bash
set -e

echo "Running startup script..."

# Run Alembic migrations to upgrade database schema to head
echo "Running Alembic database migrations..."
alembic upgrade head

# Run schema migrations and seed scripts
echo "Running schema migrations and seeding..."
python scripts/run_migrations.py

# Start the application
echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
