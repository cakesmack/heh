#!/bin/bash
set -e

echo "Running startup script..."

# Run backfill script
echo "Backfilling usernames..."
python scripts/backfill_usernames.py

# Start the application
echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
