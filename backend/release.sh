#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Running Alembic Database Migrations ==="
alembic upgrade head

echo "=== Running Database Migrations ==="
python scripts/run_migrations.py

echo "=== Running Database Seeding and Verification ==="
python -m app.scripts.migrate_slot_pricing
