#!/bin/bash
set -e

echo "Running startup script..."

# Run migration script
echo "Running venue status migration..."
python scripts/migrate_venues_status.py
echo "Running schema migrations..."
python scripts/run_migrations.py

# Start the application
echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
