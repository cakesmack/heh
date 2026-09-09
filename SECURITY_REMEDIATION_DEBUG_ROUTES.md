# Security remediation: groups debug routes

**Date:** 9 September 2026

**Branch:** `dev`

**Audited/deployed base commit:** `69d19661703260bf299288576577d9143ebdf5b2` (`69d1966`)

**Scope:** `backend/app/api/groups.py` debug and schema-repair HTTP routes only

## Original issue

The production groups router registered two temporary diagnostic routes:

* `GET /api/groups/debug/check-roles` queried the PostgreSQL `grouprole` enum and returned its values. On failure it returned the raw exception string and complete Python traceback to the client.
* `GET /api/groups/debug/add-admin-role` executed `ALTER TYPE grouprole ADD VALUE IF NOT EXISTS 'ADMIN'` and committed the schema change. On failure it also returned the raw exception and traceback.

Neither route required authentication or authorization. Both were included in the production application because `backend/app/main.py` mounts the groups router at `/api/groups`.

## Exposure and dependency investigation

Static repository searches found no frontend call, automated test, script, operational command, or current documentation that consumes either endpoint. The only non-source references were audit findings in `REPOSITORY_CLEANUP_PLAN.md`, `REPOSITORY_INVENTORY.md`, and `_archive/misc/BACKEND_AUDIT_REPORT.md`.

Local Git history shows that the enum-inspection route was introduced by commit `e9e7b77` on 25 January 2026 as a debug endpoint. The schema-repair route followed in `91da490`; commit `5ef8cf0` then changed it from POST to GET for browser access. Source comments called the block temporary enum diagnosis. This supports removal rather than retaining an operational API contract.

No legitimate production dependency was found. External traffic and Render logs were not inspected, so repository evidence cannot prove that nobody has manually bookmarked the paths. Such a bookmark is not a valid reason to preserve an unauthenticated schema-changing GET endpoint.

## Remediation

Both route definitions were removed completely from the mounted groups router. Their inline SQL, commits, enum introspection, raw exception responses, and traceback responses were removed with them. The now-unused `sqlmodel.func` import was also removed.

No replacement HTTP maintenance endpoint was added. Any future enum/schema correction must use the established migration process and must not be implemented as an ordinary public GET request.

The normal invite, join, membership, member-list, member-removal, and member-role routes were not changed.

### Reconciled normal-route count

The groups router contains **eight route declarations**, **eight unique path patterns**, and **eight unique HTTP method + path combinations** after removing the two debug routes:

| Method | Path pattern |
|---|---|
| POST | `/{group_id}/invite` |
| GET | `/{group_id}/invites` |
| DELETE | `/{group_id}/invites/{token}` |
| POST | `/join/{token}` |
| GET | `/{group_id}/members` |
| DELETE | `/{group_id}/members/{user_id}` |
| PUT | `/{group_id}/members/{user_id}/role` |
| GET | `/{group_id}/membership` |

The earlier report wording said the test checked seven patterns because its expected set omitted `DELETE /{group_id}/invites/{token}`. The production route was always present and was never removed. The test expectation and this wording have been corrected; there is no duplicate route path causing the difference.

## Files changed

| File | Change |
|---|---|
| `backend/app/api/groups.py` | Removed `/debug/check-roles`, `/debug/add-admin-role`, all related SQL/error disclosure code, and the unused `func` import. |
| `backend/tests/test_groups_debug_routes_removed.py` | Added three standard-library source-level regression tests. They parse the router without importing the application. |
| `SECURITY_REMEDIATION_DEBUG_ROUTES.md` | Added this remediation record. |

No migration, model, deployment, Stripe, ticketing, frontend, or unrelated router file was modified.

## Verification performed

The focused regression test verifies that:

1. neither removed path, nor any `/debug/` route, is registered in the groups router source;
2. the groups router no longer contains the schema-changing `ALTER TYPE`, PostgreSQL enum-introspection query, or `traceback.format_exc` response code; and
3. all eight expected normal route declarations, unique path patterns, and HTTP method + path combinations remain registered.

Command run from `backend/`:

```text
python tests/test_groups_debug_routes_removed.py
```

Result: **3 tests passed**.

The test uses only `ast`, `pathlib`, and `unittest`. It reads `groups.py` as text. It does not import FastAPI application modules, load application settings, create an engine, invoke lifespan hooks, open a network connection, or execute SQL. Broad pytest discovery was intentionally not run because the cleanup audit documented unresolved database-isolation risks.

`git diff --check` passed. A post-change static route scan found no remaining backend API path containing `debug`, `diagnostic`, `repair`, or `schema`.

Post-change searches for the exact removed paths are expected to find only this test/report and historical audit records. No executable caller remains.

## Database and deployment safety

No endpoint was called. No application process was started. No database connection was opened, no SQL or migration command was executed, and no data or schema was changed during this remediation.

The currently deployed `69d1966` revision will remain exposed until this remediation is committed and deployed through the normal reviewed process. Deployment was not part of this task.

## Remaining risks and later review

* `POST /api/campaigns/test` remains as an intentional admin-authorized test-email operation. It is not a database diagnostic or schema-repair endpoint. Its authentication, audit logging, rate limiting, and outbound-email safeguards merit a later operational security review.
* `groups.py` still writes a role value and caught update error to server output. It returns a generic client error and does not expose a traceback, but structured logging and sensitive-log policy can be reviewed later without changing group behavior in this task.
* Separate endpoints in `checkout.py` and `featured.py` return selected exception strings to clients. They were outside this narrowly scoped groups-route remediation and should be assessed in a later API error-disclosure review.
* The source-level test proves the dangerous router declarations and SQL are absent without risking a database connection. An isolated HTTP integration test should later verify 404 responses once the planned test-environment isolation work is complete.
