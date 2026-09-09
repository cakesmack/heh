# Development setup

This guide records the repository contract established during Batch 0A. It is based on static inspection of the `dev` branch at security remediation commit `e683fef`. No dependency installation, application startup, migration, database connection, or runtime test was performed while preparing it.

## Supported architecture

* Backend: Python 3.11, FastAPI, SQLModel/SQLAlchemy, PostgreSQL, and Alembic.
* Frontend: Next.js Pages Router, React, TypeScript, Tailwind CSS, and npm.
* Database: PostgreSQL. Do not use SQLite as an application or migration substitute.

The backend Dockerfile currently selects Python 3.11. The frontend lock contains dependencies that require Node 22.13 or newer, while the current frontend Dockerfile still selects Node 18. Runtime and container corrections belong to Batch 0B. Until that work is approved and verified, do not treat the frontend Dockerfile as a supported production build contract.

## Dependency inputs

The following files are the dependency and compiler sources of truth:

```text
backend/requirements.txt
frontend/package.json
frontend/package-lock.json
frontend/tsconfig.json
scripts-node/package.json
scripts-node/package-lock.json
```

From `backend/`, the confirmed Render build command is:

```text
pip install -r requirements.txt
```

For a frontend checkout using a compatible Node runtime, install the exact lockfile dependency graph with:

```text
npm ci
```

The repository currently defines frontend `dev`, `build`, and `start` scripts. It does not define supported `test`, `typecheck`, or `lint` npm scripts. Establishing those verification commands belongs to Batch 0C.

The `scripts-node` manifest defines a database-writing `npm start` command and currently relies on an unpinned `npx tsx` executor that is absent from its lock. Track the manifests for provenance, but do not run the command until the maintenance tooling is separately reviewed.

## Backend environment

Use `backend/.env.example` as the name and format reference. Create a private `backend/.env` locally and supply environment-specific values yourself. Never copy production values into the example and never commit a real environment file.

At minimum, application configuration requires:

```text
DATABASE_URL
SECRET_KEY
```

The template also lists optional service, email, media, boundary, and feature settings accepted by `backend/app/core/config.py`. Values resembling keys in the template are explicit placeholders only. Public sender addresses and localhost URLs are examples/defaults, not credentials.

The existing startup paths can execute Alembic, SQL-ledger migrations, table creation, data backfills, and inline PostgreSQL changes. Do not run `start.sh`, `release.sh`, application lifespan startup, or migration commands against any database until the intended disposable or production database and migration state have been explicitly confirmed.

## Frontend environment

Keep frontend values in the ignored `frontend/.env.local`. Current source references include:

```text
NEXT_PUBLIC_API_URL
INTERNAL_API_URL
NEXT_PUBLIC_BASE_URL
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_GOOGLE_MAPS_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
NEXT_PUBLIC_GOOGLE_MAP_ID
NEXT_PUBLIC_MAP_ID
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_HASH
NEXT_PUBLIC_IMAGE_BASE_URL
NEXT_PUBLIC_GA_MEASUREMENT_ID
NEXT_PUBLIC_STAY22_AID
```

Only values intended for browser exposure may use the `NEXT_PUBLIC_` prefix. Keep server credentials, Stripe secret keys, Cloudflare API tokens, SMTP passwords, and database URLs out of frontend public variables.

## Verification status

Batch 0A performs repository-only verification. It does not prove that a fresh database can migrate, that the application starts, or that the current test suite is isolated. Those remain explicit gates:

1. Fresh PostgreSQL bootstrap requires a dedicated migration-safety task.
2. Backend tests require global engine and lifespan isolation before broad discovery.
3. Frontend runtime/container alignment belongs to Batch 0B.
4. Frontend and backend verification command setup belongs to Batch 0C.

## External scraper boundary

Event scrapers intentionally live in a separate project outside this repository and currently run manually. Do not restore a local `scrapers/` tree or change its ignore rule as part of application repository work. Document only the typed endpoint and payload contract when the external integration is audited separately.
