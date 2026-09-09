# Backend test isolation report

## Scope

Batch 0C changes test infrastructure only. It does not change application runtime code, database models, migrations, deployment configuration, frontend code, or business assertions.

The approved suite contains 18 modules and 72 pytest-collected tests under `backend/tests`.

## Original risks

`app.core.config.settings` and `app.core.database.engine` are created while application modules are imported. The engine uses the configured `DATABASE_URL`.

Application lifespan directly performs all of the following outside FastAPI request dependency overrides:

1. Checks the application-global database engine.
2. Calls `SQLModel.metadata.create_all(engine)`.
3. Calls the SQL migration wrapper.
4. Runs inline PostgreSQL migrations through the global session dependency.

`test_scanner.py`, `test_organizer_invoices.py`, and `test_cancellation_and_reschedule.py` entered application lifespan through context-managed `TestClient` instances. Their request-level `get_session` overrides did not protect lifespan, so a shell or `.env` production/development URL could be contacted and mutated.

The common conftest imported email services before establishing test environment values. Provider objects could therefore inherit real Resend or SMTP settings. Other application modules could inherit Stripe, Cloudflare, Google, Cloudinary, OS, scraper, or cron credentials.

Broad pytest discovery could also collect `backend/scratch/test_event_update_moderation.py` and historical `archive/test*.py` files. Static inspection confirms those locations contain direct configured-engine access, existing-record queries, commits, deletes, or API activity.

## Discovery configuration

The root `pytest.ini` defines:

* `testpaths = backend/tests`
* `python_files = test_*.py`
* `pythonpath = backend`, so repository-root pytest runs can import the existing `backend/app` package as `app`
* exclusions for Git/cache/bytecode, virtual environments, dependency trees, frontend and Node tooling, generated/build output, `scratch`, `archive`, and `_archive`
* strict marker handling and strict pytest-asyncio mode

The approved command remains explicit:

```text
python -m pytest backend/tests
```

No scratch or archived test was executed or moved.

## Environment and database isolation

`backend/tests/conftest.py` establishes test values before importing any `app.*` module. It overwrites `DATABASE_URL` even when a real URL exists in the invoking shell and clears the pooler URL.

The replacement URL targets a process-specific SQLite file under the operating-system temporary directory. The conftest refuses to continue unless:

* the environment URL exactly matches that generated test URL;
* the loaded application settings exactly match it;
* the path resolves inside the operating-system temporary directory; and
* the application-global engine uses SQLite and resolves to that exact file.

The temp engine is a safety backstop for application globals. Existing test fixtures continue to create independent in-memory SQLite engines and override `get_session` for request handlers. The temp engine is disposed and its exact file is removed at session finish.

This prevents the approved suite from inheriting or opening a PostgreSQL production database, a normal development database, a pooled Render URL, or any other database target.

## TestClient and lifespan handling

All current tests are handler/request or direct service tests. No test asserts application startup behaviour.

The three context-managed clients were changed to ordinary `TestClient(app)` instances and are closed explicitly. Ordinary clients do not enter FastAPI lifespan.

An autouse fixture also replaces the application's lifespan context with a guard that raises immediately. A future handler test that attempts to enter lifespan will fail instead of running database checks, table creation, SQL-ledger migrations, or inline migrations.

Startup-dependent tests require a separately approved disposable PostgreSQL strategy. There are currently no approved category-B startup tests.

## External-service safeguards

Before application imports, the conftest replaces external-service settings with empty or visibly test-only values for:

* Stripe and Stripe webhooks;
* Resend, Hostinger SMTP, Gmail SMTP, and campaign SMTP;
* Cloudflare and Cloudinary;
* Google Maps/geocoding and Ordnance Survey;
* scraper and cron secrets.

Existing email service and SDK calls remain mocked. Existing tests mock intended Stripe operations. An autouse fixture blocks `socket.socket.connect`, `socket.socket.connect_ex`, and `socket.create_connection`, causing any unexpected outbound network attempt to fail before reaching a remote service.

## Test-only dependencies

`backend/requirements-dev.txt` includes the production requirements and adds only:

* `pytest`
* `pytest-asyncio`

They remain outside the production Render dependency manifest.

## Verification and results

Static verification confirmed:

* every backend test module parses successfully;
* ordinary discovery points only to `backend/tests`;
* scratch and archive roots are excluded;
* environment replacement precedes all application imports in conftest;
* no context-managed `TestClient(app)` remains;
* all per-test database engines use SQLite;
* the global engine guard requires the exact temporary SQLite target;
* no production application, model, migration, deployment, or frontend file is part of this batch;
* the known `frontend/next-env.d.ts` modification remains untouched.

A local engine-construction check confirmed that the existing production pool arguments accept the isolated SQLite file URL, resolve to the expected temporary path, and do not create the file without a connection.

### First isolated baseline — 2026-09-09

Environment:

* Python: 3.14.0
* pytest: 9.1.1
* pytest-asyncio: 1.4.0

Collection completed cleanly with 18 modules and 72 tests. No test from `backend/scratch`, `archive`, or `_archive` appeared. The earlier static estimate of 84 tests was inaccurate: current syntax-tree inspection finds 87 `test_`-prefixed definitions, of which 15 are fixtures named `test_db_fixture`. Pytest correctly excludes those fixtures, leaving 72 runnable tests.

The scoped baseline command `python -m pytest backend/tests` completed in 15.63 seconds:

* Collected: 72
* Passed: 16
* Failed: 55
* Skipped: 0
* Errors: 1
* Warnings: 411

The 55 failures and one setup error form one test-isolation/fixture group. The outbound network guard replaces `socket.socket.connect`, `socket.socket.connect_ex`, and `socket.create_connection`. On Windows with Python 3.14, AnyIO/TestClient and asyncio create internal loopback socket pairs while starting their event loops. The guard rejects those `127.0.0.1` connections before request handlers execute. The affected modules and counts are:

* `test_auto_seller_verification.py` — 1 failure
* `test_cancellation_and_reschedule.py` — 1 failure
* `test_checkout.py` — 4 failures
* `test_collections.py` — 11 failures
* `test_event_moderation_queue.py` — 6 failures
* `test_fee_settings_api.py` — 1 failure
* `test_location_hubs.py` — 1 failure
* `test_operational_safeguards.py` — 5 failures
* `test_organizer_invoices.py` — 2 failures
* `test_private_beta_ticketing_gating.py` — 6 failures
* `test_scanner.py` — 1 failure
* `test_sellers.py` — 7 failures
* `test_streamlined_event_publishing.py` — 2 failures and 1 setup error
* `test_terms_acceptance.py` — 4 failures
* `test_webhooks.py` — 3 failures

These results do not establish application regressions or stale expectations for the affected tests because their handlers did not run. They block cleanup work that depends on those 56 tests. The next test-infrastructure investigation should permit only the loopback communication required by the local event-loop/TestClient implementation while continuing to reject non-loopback network destinations.

The 16 direct-service, schema, fee, and static security tests that did not require the blocked loopback path passed. No remote database or production/development database was contacted. The application-global database remained bound to its process-specific temporary SQLite target, per-test databases were isolated in-memory SQLite instances, no application lifespan ran, and no migration executed. No external network connection or Stripe, email, Cloudflare, Google, or other provider request completed. The temporary SQLite file was removed at session finish.

## Remaining risks

The suite still uses SQLite compatibility shims and does not establish PostgreSQL behavioural fidelity. Fresh PostgreSQL migration/bootstrap verification remains a separate task.

The socket guard currently blocks required Windows loopback socket-pair setup as well as external destinations. Until that isolation fixture is refined, 56 TestClient/async tests cannot provide application-level results. Future tests that launch subprocesses or deliberately replace the guard require a separate safety review.
