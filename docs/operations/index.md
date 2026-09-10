# Operations and maintenance index

This index classifies operational entrypoints using the current [repository cleanup plan](../../REPOSITORY_CLEANUP_PLAN.md). It is a review guide, not a runbook. Confirm the target environment, ownership, database state, backups, and current deployment configuration before executing any mutating entrypoint.

## Startup and migrations

The startup and migration chain includes `backend/start.sh`, `backend/release.sh`, Alembic revisions under `backend/alembic/`, SQL migrations under `backend/migrations/`, `backend/scripts/run_migrations.py`, application lifespan work, and inline migrations. These mechanisms overlap, and fresh PostgreSQL bootstrap and deployed migration state remain unresolved. Preserve them until the dedicated migration audit is complete.

## Operational scripts

`backend/app/scripts/backfill_preferences.py` and `backend/app/scripts/migrate_slot_pricing.py` are called through existing migration or release paths. They can change data or schema and must remain coupled to their reviewed operational entrypoints.

Scheduling for `backend/app/scripts/expire_featured.py` has not been confirmed. Its source describes recurring featured-booking maintenance, but no repository scheduler proves that it runs. Treat its ownership and invocation as unresolved.

## Maintenance and recovery tools

The following groups require separate operator and data-safety review before use:

* image migration and recovery tools, including `backend/scripts/cutover_images.py`, `backend/scripts/sync_live_db.py`, and their retained mappings;
* NC500 tagging and cleanup scripts, whose preview and apply criteria require review;
* duplicate repair tooling, which can reassign records and intersects ticketing relationships;
* `backend/scripts/apply_constraints.py` and `backend/scripts/fix_admin_user.py`, which can change schema or account state;
* Node venue maintenance tools under `scripts-node/`, which write database records and have unresolved execution assumptions.

## Dangerous, debug, and historical utilities

`backend/scratch/test_event_update_moderation.py` can alter existing records and must not be treated as an isolated test. Debug and migration utilities under archive locations may query or mutate configured databases and remain historical evidence. Do not execute or move them without the separately approved cleanup batch.

External schedules, operator-owned commands, and production migration state remain unresolved. No scheduler is asserted by this document.
