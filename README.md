# Highland Events Hub

Highland Events Hub is a Next.js and FastAPI application for discovering, publishing, mapping, promoting, and ticketing events across the Scottish Highlands.

## Architecture

* `frontend/` — Next.js Pages Router application written in TypeScript and styled with Tailwind CSS.
* `backend/` — FastAPI application using SQLModel/SQLAlchemy and PostgreSQL.
* `backend/alembic/` — Alembic revision history.
* `backend/migrations/` — additional filename-ledger SQL migrations retained by the existing startup process.
* `scripts-node/` — manual venue-recovery tools. These can modify database records and must not be used as normal application startup commands.
* `docs/` — maintained development and operational documentation.

The authoritative application rules are in [events_hub_context.md](events_hub_context.md). Repository-specific agent rules are in [AGENT_RULES.md](AGENT_RULES.md) and [.agents/AGENTS.md](.agents/AGENTS.md).

## Development setup

See [docs/development/setup.md](docs/development/setup.md) for the current dependency, environment, and command contract.

Important current limitations:

* Do not assume a new PostgreSQL database can be initialised by the existing Alembic baseline. Fresh-database bootstrap remains blocked pending a dedicated migration task.
* The approved isolated backend suite is `python -m pytest backend/tests`; its recorded baseline is 75 passing tests. Do not explicitly collect scratch or archived paths.
* The frontend container runtime and production image behaviour remain scheduled for Batch 0B; they are not changed here.

## Deployment context

The active project branch is `dev`. The confirmed Render build command for the backend is:

```text
pip install -r requirements.txt
```

Render start, pre-deploy/release, worker, cron, and frontend deployment settings must be checked in Render before changing deployment behaviour. No deployment settings are defined or changed by this documentation.

## External scrapers

Event scrapers intentionally live in a separate project and are run manually. They are not part of this repository. This application retains only its typed ingestion and administrative import integration points.

## License

Proprietary. All rights reserved.
