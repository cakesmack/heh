# Development setup

This guide records the repository contract established during Batches 0A and 0C. Batch 0C added backend test isolation without changing application runtime behaviour.

## Supported architecture

* Backend: Python 3.11, FastAPI, SQLModel/SQLAlchemy, PostgreSQL, and Alembic.
* Frontend: Next.js Pages Router, React, TypeScript, Tailwind CSS, and npm.
* Database: PostgreSQL. Do not use SQLite as an application or migration substitute.

The backend Dockerfile currently selects Python 3.11. The frontend lock contains dependencies that require Node 22.13 or newer, while the current frontend Dockerfile still selects Node 18. Runtime and container corrections belong to Batch 0B. Until that work is approved and verified, do not treat the frontend Dockerfile as a supported production build contract.

## Dependency inputs

The following files are the dependency and compiler sources of truth:

```text
backend/requirements.txt
backend/requirements-dev.txt
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

The repository defines frontend `dev`, `build`, `start`, and explicit non-incremental `typecheck` scripts. It does not define supported `test` or `lint` npm scripts. The current command results and blockers are recorded in [the frontend verification baseline](../../FRONTEND_VERIFICATION_BASELINE.md).

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

## Safe backend tests

Install production and test-only dependencies from the dedicated development manifest:

```text
pip install -r backend/requirements-dev.txt
```

From the repository root, the approved backend test command is:

```text
python -m pytest backend/tests
```

`pytest.ini` restricts ordinary discovery to `backend/tests`. Do not pass scratch, archive, or historical paths explicitly.

The test conftest overwrites database and external-service settings before application modules are imported. The application-global engine is restricted to a process-specific SQLite file in the operating-system temporary directory, while individual tests continue to use their existing in-memory SQLite databases. Application lifespan is disabled for this handler-only suite so table creation and migration helpers cannot run. Numeric loopback sockets required by the local test runtime are allowed; hostnames and non-loopback destinations remain blocked, and email providers are mocked.

SQLite is used here only as the existing suite's isolation mechanism. It is not an application runtime or PostgreSQL migration substitute.

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

## Frontend verification

From `frontend/`, run the explicit typecheck with:

```text
npm run typecheck
```

The production build command remains:

```text
npm run build
```

The 10 September 2026 baseline records 33 existing TypeScript diagnostics. A loopback-guarded production build also fails because `next/font/google` attempts to retrieve Inter from Google Fonts. Do not treat the build's configured TypeScript skip as a successful typecheck, and do not connect a local verification run to production services to bypass the font failure.

The new local-only Playwright smoke test can be collected without starting a browser or server:

```text
node node_modules/@playwright/test/cli.js test tests/smoke.spec.ts --project=chromium --list
```

The smoke test is fixed to `http://127.0.0.1:43119` and rejects external browser requests. Its execution remains blocked until a safe production build exists and the declared Chromium browser is installed.

## Verification status

Repository and test-infrastructure verification does not prove that a fresh database can migrate or that the application starts. Those remain explicit gates:

1. Fresh PostgreSQL bootstrap requires a dedicated migration-safety task.
2. The isolated backend baseline passes 75 tests when the declared packages in `backend/requirements-dev.txt` are installed.
3. Frontend runtime/container alignment belongs to Batch 0B; local Node 25.1.0 satisfies the current lock, while deployment configuration remains unchanged.
4. Frontend typecheck and smoke collection commands now exist, but V2 fails with 33 diagnostics and V3 is blocked by the Google Fonts build request. See the frontend verification baseline before Batch 4 work.

## External scraper boundary

Event scrapers intentionally live in a separate project outside this repository and currently run manually. Do not restore a local `scrapers/` tree or change its ignore rule as part of application repository work. Document only the typed endpoint and payload contract when the external integration is audited separately.
