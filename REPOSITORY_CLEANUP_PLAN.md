# Repository cleanup plan — Highland Events Hub

**Prepared:** 9 September 2026. **Status:** proposal only; no cleanup batch approved or implemented.
**Repository:** `C:/Users/Craig/Desktop/projects/antigrav/heh/highland_events_app`.
**Inspected Git HEAD:** `69d19661703260bf299288576577d9143ebdf5b2`.

**Deployment confirmation — 9 September 2026:** Craig confirmed the Render build command is `pip install -r requirements.txt`, the current deployed commit is `69d1966` (“Fix 404 on seller stripe connect onboarding for non-admin users”), and the project currently uses the `dev` branch. Read-only local Git inspection confirms the checkout is on `dev` and its HEAD is the full commit above. Render itself was not queried. These facts do not establish the start/predeploy command, service root, runtime version or database migration state.

## Executive summary — prioritised findings

| Priority | Finding and evidence | Impact and decision |
|---|---|---|
| 🔴 CRITICAL | `backend/app/api/groups.py:55` exposes GET `/api/groups/debug/add-admin-role` with a database session but no authentication dependency; it executes `ALTER TYPE` and commits. The router is mounted by `app/main.py`. Its companion diagnostic endpoint returns database errors/tracebacks. | **Production security/schema safety:** source-confirmed capability; actual deployed exposure unverified. Request a separate targeted security fix before deployment-related work. Do not call this endpoint as a smoke test. No changes in this plan. |
| 🔴 CRITICAL | `backend/scratch/test_event_update_moderation.py` selects existing records, edits data and deletes featured bookings. `archive/test_api.py`, `archive/test_db.py`, `archive/verify_final.py` contain import-time database/API activity. Context-managed TestClient fixtures in three current test modules invoke application lifespan, whose global engine bypasses request dependency overrides. | **Data/payment safety during verification:** broad pytest discovery or apparently harmless startup checks can reach the configured database. Establish isolation before running tests; retain/quarantine source only through an approved later batch. |
| 🟠 HIGH | The Alembic base revision `2b4255d70229` drops existing indexes/tables, including `schema_migrations`, then alters existing tables. It does not create an empty database. `start.sh` runs it before application `create_all`. SQL migration 006 deletes account-specific featured-booking history. | **Deployment/reproducibility:** empty-database bootstrap is not proven and will encounter absent objects; replay on an unstamped existing database is hazardous. Preserve every migration; dedicated bootstrap/state audit required. |
| 🟠 HIGH | Startup/release, SQL-ledger migrations, `create_all`, seed/backfill scripts and inline PostgreSQL DDL overlap. Some failures are caught while startup continues. | **Production reliability:** order, partial completion, concurrent workers and silent drift require production-state confirmation. No consolidation in cleanup. |
| 🟠 HIGH | Frontend Docker uses Node 18; the lock pins Next 16.0.7 requiring Node >=20.9 and isomorphic-dompurify 3.19/jsdom 29.1.1 requiring newer ranges. Docker build is commented out and the command serves development mode. Neither image has a `.dockerignore`. | **Build/deployment:** current frontend container runtime is incompatible; local Docker contexts can include ignored secrets/caches through `COPY . .`. Confirm actual Render process; fix image/runtime settings separately in Batch 0 substeps before testing deployment. |
| 🟠 HIGH | No repository scheduler proves whether `expire_featured.py` runs. `deploy_fix.py` documents an old Render release path; image and venue repair tools can write broadly. | **Operational continuity/data safety:** absence of imports does not establish disuse. Keep all operational paths until Render/operator checks are complete. |
| 🟡 MEDIUM | Contrary to the earlier inventory narrative, all three frontend build JSON files are tracked. Node maintenance manifests and `backend/.env.example` are genuinely ignored/untracked. `docs/` is empty and an unanchored ignore also hides `_archive/docs/`. | **Repository maintenance:** correct the diagnosis here, narrowly permit required files, review content before staging. Do not change scraper exclusions. |
| 🟡 MEDIUM | Python dependencies are mostly unpinned; pytest and pytest-asyncio are absent from requirements. Frontend tests are missing despite Playwright configuration and historical reports. Build skips TypeScript errors; there is no lint/test/typecheck npm script. | **Verification readiness:** establish a reproducible baseline and small critical checks before dead-code removal. Historical failure reports are evidence, not a passing baseline. |
| 🟡 MEDIUM | Static TypeScript AST analysis confirms 41 of 240 source modules have no path from 74 Pages Router files plus middleware. Several are compatibility exports; active replacements share dependencies with old chains. | **Code maintenance:** remove only independently approved groups after route/behaviour tests. Keep compatibility wrappers and all public routes/assets initially. |
| 🟢 LOW | Source-backed bytecode, pytest cache metadata, empty scratch directories and a tracked TypeScript incremental cache add clutter. Historical scripts/documents and source-less migration bytecode are different: they retain recovery evidence. | **Cosmetic/local development:** narrow generated cleanup can precede code cleanup; preserve investigation artefacts. No blanket directory deletion. |

## Scope, evidence and corrections

The master context, `AGENT_RULES.md`, `.agents/AGENTS.md` and the complete `REPOSITORY_INVENTORY.md` were read before analysis. Architectural and production behaviour constraints remain binding. This plan changes neither those files nor application code. The earlier report remains an immutable record of the preceding phase; factual corrections below supersede its cleanup interpretation.

Static inspection covered the inventoried 577 significant files, the generated-directory inventory, local Git index/history, configuration, script operations, migration edges and a fresh TypeScript syntax-tree dependency graph. All 577 significant file hashes still matched the earlier inventory when this phase's baseline was recorded. Dependency packages were inspected as metadata/parser tools, not application entrypoints. No database connection, application startup, migration, package install, production build, pytest collection, payment call or browser test was run. No current pass/fail baseline is claimed. Local reachable Git history was searched without fetching; it cannot prove what exists in remote-only branches or deployed images.

Corrections to the prior report: (1) frontend package/lock/tsconfig are **tracked**, though ignore patterns match when tracked status is disregarded; (2) `scripts-node/auto_generate_venues.ts` generates venue records from existing event coordinates, not Google geocoding; (3) `_app` and `_document` are framework entry files, not ordinary public URLs; (4) obsolete form references in `SYSTEM_MAP.md` describe history and do not establish current imports.

All paths below are relative to the repository root unless prefixed `../`. Script classifications describe source evidence and retention decisions, not permission to execute. “No inbound reference” means no confirmed repository call/import; it never proves that an external operator, scheduler, deployment or consumer does not depend on the path.

External scrapers intentionally belong to a separate project and run manually. Their absence is not a defect. Keep `scrapers/` ignored. Only document the application's typed ingestion/admin import boundaries; scraper discovery, restoration and automation redesign are outside this plan.

## A. Git tracking and reproducibility

| Item | Actual status / should track? | Security and reproducibility assessment | Exact proposed ignore treatment |
|---|---|---|---|
| frontend/package.json | Tracked; KEEP tracked | Application dependency and command contract. Lock keeps current install deterministic despite next/react “latest” declarations. Inspected: no machine paths, embedded credentials or local dependencies. | Append !/frontend/package.json after *.json. |
| frontend/package-lock.json | Tracked; KEEP tracked | Lock v3 agrees with manifest dependencies/devDependencies. Inspected resolved hosts are registry.npmjs.org; no URL credentials or file dependencies. | Append !/frontend/package-lock.json. |
| frontend/tsconfig.json | Tracked; KEEP tracked | Required compiler alias/include configuration; relative paths only. Not a secret. | Append !/frontend/tsconfig.json. |
| scripts-node/package.json | Ignored/untracked; track after review | Defines manual repair dependencies and a data-writing start command. Adding the file does not run that command. tsx is missing from dependencies; recover tool has wrong env path. | Append !/scripts-node/package.json. |
| scripts-node/package-lock.json | Ignored/untracked; track with manifest | Lock v3 matches manifest; public registry URLs, no machine paths or credential-bearing resolutions found. It does not supply the missing tsx executor. | Append !/scripts-node/package-lock.json. |
| backend/.env.example | Present, ignored/untracked; track sanitised template | Credential fields inspected as placeholders/empty/local examples; nonplaceholder app constants are not secrets. Outdated SMTP names and missing newer service settings need documentation. Repeat staged secret review before adding. | Append !/backend/.env.example after env/example exclusions. |
| .env.example at root | Absent; do not invent duplicate | User shorthand resolves to existing backend template. No need to create root copy. | No root exception required. |
| docs/ | Empty and ignored; track approved future documents | Git tracks files, not empty directories. Historical docs may contain identities, example passwords, machine paths or deployment details; screen individually before moving/staging. | Replace unanchored docs/ line with /_archive/docs/. New docs paths become eligible; historical local originals remain ignored pending Batch 2. |
| frontend/tsconfig.tsbuildinfo | Tracked generated file; future DELETE | Compiler cache, not source. Baseline diagnostics must be saved separately first. | Add /frontend/*.tsbuildinfo; later remove only this tracked cache in Batch 1. |
| Real .env files, uploads, database dumps | KEEP local/ignored | May contain live credentials or user data. Never bulk-stage these. Ignore is not Docker context protection. | Preserve current exclusions; no broad JSON/CSV/env unignore. |

### Exact proposed `.gitignore` edit (not applied)

Replace the comment `# Documentation (local only)` with `# Historical local documentation pending review`, and change the immediately following `docs/` to `/_archive/docs/`. Append these lines after existing rules:

```gitignore
# Required dependency and compiler manifests
!/frontend/package.json
!/frontend/package-lock.json
!/frontend/tsconfig.json
!/scripts-node/package.json
!/scripts-node/package-lock.json
# Sanitised onboarding template
!/backend/.env.example
# Local TypeScript incremental cache
/frontend/*.tsbuildinfo
```

Keep `*.json`, `*.csv`, actual environment exclusions, historical script exclusions and `scrapers/` unchanged. Tracked files remain tracked regardless of matching ignore patterns. Use explicit staging paths, never broad force-add or `git add -A` for these local archives. No new template is implied at repository root. Broadening JSON allowlists is unnecessary for the current application.

### Concrete fresh-clone/deployment risks

| Capability | Finding | Required preparation; no change performed |
|---|---|---|
| Frontend install | Required files are present in Git and current manifest/lock roots agree. Docker Node 18 conflicts with lockfile engine ranges. Next/react “latest” allows future lock regeneration to drift. | Use `npm ci` with a runtime satisfying the whole current lock. One compatible runtime family is Node 22 at >=22.13.0; select and record the exact deployed/tested patch rather than assuming an arbitrary version. Preserve the lock. |
| Backend install | `requirements.txt` has broad/unpinned ranges; Docker declares Python 3.11 while historical local reports show Python 3.14. No dedicated test manifest. | Record tested Python/system/PostgreSQL versions and lock resolved dependencies in a separately reviewed reproducibility substep. Do not derive the project lock from every package in a developer's global environment. |
| Frontend build | `typescript.ignoreBuildErrors=true`; legacy eslint suppression exists, no installed direct ESLint dependency/config. Build includes PWA generation into public. Historical log used different build invocation and failed. | Establish separate type check and production build on an isolated checkout; do not interpret build alone as type/lint success. Retain sanitisation and SSR architecture. |
| Frontend start | npm start uses shell `$PORT`; unset PORT and Windows npm cmd-shell expansion can fail. Container currently runs dev and never builds. | Confirm Linux Render command/PORT; document local Windows launch explicitly using installed Next CLI with an explicit local port. Choose dev-versus-production container behaviour deliberately in a dedicated Batch 0 substep. |
| Backend startup | `start.sh` Git mode 100644, while release.sh is executable. Docker chmod makes its own copy executable; direct Render `./start.sh` is not proven. Default start port 10000 differs from EXPOSE 8000. | Confirm exact Render working directory, command (`bash start.sh` versus executable), PORT, predeploy/release and worker count. Do not alter shell order while organising files. |
| Database bootstrap | Baseline begins DROP/ALTER on preexisting schema. Empty DB cannot pass normal start.sh path. Current metadata creation is not a migration bootstrap strategy. | Dedicated migration bootstrap audit against a disposable PostgreSQL instance and production-state evidence; no blind `stamp head`, baseline rewrite or `create_all` workaround. |
| Local compose | Compose runs uvicorn reload directly, bypassing start.sh/Alembic, while lifespan still creates/migrates. Browser API URL localhost:8000 is also used for server fetches from inside frontend container, where localhost is the wrong service. | Document separate browser/internal API addressing before proposing a minimal configuration/code fix. Current development volumes and sample credentials are for local use only. Fresh local startup is not proven by compose syntax. |
| Docker context | Neither frontend nor backend has .dockerignore; `COPY . .` can carry .env files, .venv/node_modules, caches or logs from local context. | In separate Batch 0 image substep, propose new context-specific .dockerignore files; exclude `.env*` (optionally allow `.env.example`), `.git`, caches, installed dependencies, reports, local DB files and logs, preserving required source/migrations/start scripts. Review `static/uploads` policy against actual deployment storage before excluding it. |
| Required settings | Existing backend example is ignored and stale; frontend public API/Google/Stripe settings need documented examples without real keys. Secret server settings must never acquire NEXT_PUBLIC prefixes. | Screen and track backend example, reconcile exact names with `app/core/config.py`; document frontend variables in development setup. Record names and purpose only, not values. |
| Manual Node tooling | Manifests absent from clones; `npm start` uses `npx tsx` but tsx is absent in lock. recover dotenv resolves outside repository backend; generator dotenv depends on current directory. | Track current manifests safely, then separately pin runner and fix documented environment/bootstrap assumptions if operator retains tools. Installing dependencies is not authorization to run npm start. |
| Production process | Craig confirmed Render build `pip install -r requirements.txt`, deployed commit `69d1966` matching the audited HEAD, and use of branch `dev`. Service root, start/predeploy commands, runtime, jobs and database revision remain unconfirmed. | Obtain the remaining checklist G facts. The supplied build command installs Python dependencies; it does not itself run migrations or build the frontend. Keeping paths is safer than inferring that unreferenced entrypoints are dead. |

## B. Generated and non-production artefacts

“SAFE IMMEDIATE CLEANUP” describes eligibility for a later explicitly approved local-only batch. It does not authorise deletion now or deletion on a live deployment. Stop relevant local processes first, resolve each absolute target inside this checkout, and exclude source-less bytecode from any cache removal.

| Exact item / selection | Classification | Reason / regeneration / ignore | Impact and release condition |
|---|---|---|---|
| Source-backed files in backend/**/__pycache__ (179 of 208 .pyc, excluding .venv) | SAFE IMMEDIATE CLEANUP | Compiled from source at corresponding parent path; Python regenerates. __pycache__/ and *.py[cod] already ignored. Select exact files only, never delete containing cache directories indiscriminately. | Local performance cache only in this checkout. Preserve 29 source-less files listed below; re-count before action. |
| .pytest_cache/ and backend/.pytest_cache/ (10 metadata files total in prior inventory) | SAFE IMMEDIATE CLEANUP | Pytest creates node IDs/failure cache again; .pytest_cache/ already ignored. Historical failure logs retained independently. | Local test ordering/last-failed state is lost, not test source or application behaviour. Export any investigator-needed node list before deletion. |
| backend/tmp/; frontend/scratch/ | SAFE IMMEDIATE CLEANUP | Empty directories, no tracked content or runtime references found. They are not automatically needed; Git does not track empties. No new ignore necessary. | Local tidiness only; verify still empty and not in use at execution time. |
| 29 source-less .pyc files listed below | RETAIN TEMPORARILY FOR INVESTIGATION | Missing revision/test/legacy source evidence; cannot regenerate without original source. Already ignored. | No cache-directory purge until revision/source provenance and deployed revision confirmed. |
| frontend/tsconfig.tsbuildinfo | RETAIN TEMPORARILY FOR INVESTIGATION | Regenerated by incremental compiler; tracked despite being a cache. May retain previous diagnostics. Proposed /frontend/*.tsbuildinfo exclusion. | After baseline preserved, Batch 1 may DELETE this exact tracked file. Local-only compiler state; re-run explicit type check. |
| frontend/.next/ | RETAIN TEMPORARILY FOR INVESTIGATION | Build/server output, including last build evidence; .next/ already ignored. Regenerated only if install/build/start prerequisites work. | Do not remove while next start/dev uses it, and never remove live production output. Eligible later in isolated/stopped local checkout after reproducible build baseline. |
| frontend/playwright-report/; frontend/test-results/; frontend/captured_e2e.txt | RETAIN TEMPORARILY FOR INVESTIGATION | Missing promotions.spec.ts is evidenced by all three-browser failures (HTTP 429 login), contexts and report. Report/results already ignored; captured_e2e.txt is tracked. | Regeneration is not currently assured because tests are absent. Preserve until test source/provenance or replacement baseline is recorded. |
| frontend/build_error.log; backend/test_output.log | RETAIN TEMPORARILY FOR INVESTIGATION | Historical build failure and missing buyer-refund test/SQLite JSONB failure. *.log already ignored. | Not evidence current build/test fails the same way; retain until safe baseline explains/replaces them. |
| scripts-node/output.log; archive/install_log.txt; archive/out.txt; archive/out_utf8.txt; _archive/logs/ | RETAIN TEMPORARILY FOR INVESTIGATION | Diagnostic/migration/repair history; source may be missing or scripts may target former environments. Logs can contain identities and internal paths. *.log or parent archive exclusion protects most, not all tracked text. | Local evidence; screen before any documentation archival, never commit raw logs automatically. |
| _archive/migration_artefacts/{db_cf_mapping.json,migration_mapping.json,migration.log} | RETAIN TEMPORARILY FOR INVESTIGATION | Recovery mapping chain for image IDs/URLs. Not safely regenerated from current DB alone after cutover. JSON/log exclusions already apply. | Potential production recovery dependency: retain exact paths until database-stored asset mapping verified. |
| frontend/public/sw.js; frontend/public/workbox-*.js; frontend/public/worker-*.js (where present) | RETAIN TEMPORARILY FOR INVESTIGATION | PWA-generated code, already frontend-ignored. Browser caches/installed clients may request these URLs. Build regenerates local output. | No deployed asset deletion or URL changes in cleanup. Local regeneration only after PWA baseline and process stop. |
| backend/.venv/; frontend/node_modules/; scripts-node/node_modules/ | KEEP | Installed local dependencies; ignored. Reinstall depends on usable manifests/runtime/network and, for Python, currently incomplete version pinning. | Do not remove as routine clutter during this stabilisation phase. |
| frontend/next-env.d.ts; frontend/public/manifest.json; public icons/images; backend/static/uploads/.gitkeep | KEEP | Framework declaration, PWA metadata, brand/runtime assets and upload directory contract. Some are generated-maintained but deliberately tracked. | Production/build behaviour. No asset removal based solely on imports or duplicate bytes. |
| docs/; frontend/tests/; frontend/public/data/; empty upload category directories | KEEP | Document/test configuration/planned/public storage contracts; Git tracks future contents, not empty directory. | Not worth churn; confirm external storage contracts before changing. |
| _archive/sqlite_dbs/ (empty) | KEEP | Historical provenance/location marker; little benefit from removal. | Local-only; can review later with archive policy. |
| ../tmp/inventory_scan.py; ../tmp/inventory_data.json; ../tmp/write_inventory.py; ../tmp/cleanup_frontend_scan.cjs; ../tmp/cleanup_frontend_data.json; ../tmp/cleanup_static_scan.py; ../tmp/cleanup_analysis.json; ../tmp/cleanup_baseline.json; ../tmp/write_cleanup_plan.py | RETAIN TEMPORARILY FOR INVESTIGATION | Audit helpers/evidence outside Git repository, not production. Re-running report generators overwrites their reports, so do not execute casually. | Retain until reports accepted and provenance retained elsewhere. Do not fold into production tooling or delete this phase. |
| ../nul | RETAIN TEMPORARILY FOR INVESTIGATION | Zero-byte Windows-named artefact in containing workspace; purpose unclear. | Confirm filesystem identity and origin before any later exact-path action; no device-name deletion commands proposed. |

### Exact source-less bytecode retention list

- `backend/__pycache__/test_api.cpython-314-pytest-9.0.2.pyc`
- `backend/__pycache__/test_db.cpython-314-pytest-9.0.2.pyc`
- `backend/__pycache__/test_schema.cpython-314-pytest-9.0.2.pyc`
- `backend/__pycache__/test_slug_migration.cpython-314-pytest-9.0.2.pyc`
- `backend/alembic/versions/__pycache__/37290838eb8d_add_native_ticketing_schema_and_tier_.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/45c6a4346817_add_pending_events_table.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/cf12601a93d6_add_native_ticketing_schema_and_tier_.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/e66034878947_add_native_ticketing_schema_and_tier_.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/f638b69b0c39_add_pending_events_table.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/fd20df60ffec_add_native_ticketing_schema_and_tier_.cpython-314.pyc`
- `backend/app/api/__pycache__/checkins.cpython-314.pyc`
- `backend/app/api/__pycache__/email_testing.cpython-314.pyc`
- `backend/app/api/__pycache__/gamification.cpython-314.pyc`
- `backend/app/api/__pycache__/hero.cpython-314.pyc`
- `backend/app/models/__pycache__/badge.cpython-314.pyc`
- `backend/app/models/__pycache__/checkin.cpython-314.pyc`
- `backend/app/models/__pycache__/hero.cpython-314.pyc`
- `backend/app/models/__pycache__/xp_log.cpython-314.pyc`
- `backend/app/schemas/__pycache__/checkin.cpython-314.pyc`
- `backend/app/schemas/__pycache__/gamification.cpython-314.pyc`
- `backend/app/schemas/__pycache__/hero.cpython-314.pyc`
- `backend/app/services/__pycache__/gamification.cpython-314.pyc`
- `backend/app/services/__pycache__/geocoding.cpython-314.pyc`
- `backend/app/utils/__pycache__/location_validation.cpython-314.pyc`
- `backend/tests/__pycache__/test_buyer_refund.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_buyer_refund.cpython-314.pyc`
- `backend/tests/__pycache__/test_cron.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_featured.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_health.cpython-314-pytest-9.0.2.pyc`

The six cached Alembic source names have no matching source in the current tree, and no matching additions/deletions were found in the locally available `git log --all` search. Several other cached modules correspond to retired features or moved debug scripts. Bytecode is not authoritative migration history; retaining it does not authorise decompilation/reintroduction or executing it. The count includes both cached variants of the missing buyer-refund test.

## C. Frontend dependency groups

### Method and limits

The independent TypeScript 5.9.3 AST scan parsed all 240 TS/TSX/JS source modules, including static imports, `import type`, literal `import(...)`, `require(...)` and export-from statements. Roots are 74 files under `src/pages/` (including framework `_app`, `_document`, error pages and API/SEO handlers) plus `src/middleware.ts`. All local source imports resolved; the only non-module resource outside the code graph is `_app.tsx`'s existing `globals.css`. There were no nonliteral dynamic module imports in this source set. 199 modules are reachable; the other 41 form the groups below. The graph conservatively counts type-only edges as dependencies.

Configuration, package scripts, historical documents, scaffold literals and exact component names/paths were checked alongside the graph. No configuration/plugin registry or dynamic resolver was found that loads these 41 modules. Generic words such as “images”, “locations”, “Skeleton” and “ErrorBoundary” occur elsewhere and were checked as text, not mistaken for imports. No package library-export contract for frontend internals was found. External source consumers and unpublished branches remain unknown; owner confirmation and rerun on the approved commit are required. Public URLs are a separate dependency surface and are retained.

**Shared rules for candidate groups:** listed outgoing active dependencies are KEEP; no npm package removals are implied. Removing an entire listed group creates no additional local orphans outside the 41-file candidate set under this conservative graph. Removing only some members can leave the explicitly listed companion orphan. Preserve type declarations shared with live code. Candidate classification is conditional evidence, not a deletion instruction.

### G1. Old admin event form

**DEAD CODE CANDIDATE — 1 files; removal risk Medium.** No active page or middleware reaches this group. No dynamic import targets any member. No inbound code or meaningful literal reference. Current admin/wizard editing reaches shared controls directly. Preserve moderation, dates, venue selection and sanitised rich text; test admin create/edit before removal.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/admin/EventForm.tsx` | None | `react` (import); `frontend/src/types/index.ts` (import); `frontend/src/components/common/ImageUpload.tsx` (import); `frontend/src/components/common/RichTextEditor.tsx` (import); `frontend/src/components/common/DateTimePicker.tsx` (import); `frontend/src/components/venues/UnifiedVenueSelect.tsx` (import); `frontend/src/components/common/GooglePlacesAutocomplete.tsx` (import); `lucide-react` (import) |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G2. Old event form sections and layout

**DEAD CODE CANDIDATE — 6 files; removal risk Medium–high.** No active page or middleware reaches this group. No dynamic import targets any member. Only the four old sections consume FormSection; only old EventLocationSection consumes MapPinAdjuster. SYSTEM_MAP.md still names EventTicketingSection but current pages use wizard. StepTimeline comments mention FormSection; they are not imports. KEEP EventScheduleSection.tsx: live StepTimeline imports it. Verify single-session <=36h, recurrence limits, external ticket URL handling, price sync, venue pin, media and submission flow; reconcile stale documentation first.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/events/form-sections/EventBasicDetails.tsx` | None | `react` (import); `frontend/src/components/common/Input.tsx` (import); `frontend/src/components/common/RichTextEditor.tsx` (import); `frontend/src/components/tags/TagInput.tsx` (import); `frontend/src/components/events/FormSection.tsx` (import); `frontend/src/types/index.ts` (import); `frontend/src/lib/api.ts` (import) |
| `frontend/src/components/events/form-sections/EventLocationSection.tsx` | None | `react` (import); `next/link` (import); `frontend/src/components/venues/UnifiedVenueSelect.tsx` (import); `frontend/src/components/venues/MultiVenueSelector.tsx` (import); `frontend/src/components/events/FormSection.tsx` (import); `frontend/src/types/index.ts` (import); `frontend/src/components/events/MapPinAdjuster.tsx` (import) |
| `frontend/src/components/events/form-sections/EventMediaSection.tsx` | None | `react` (import); `frontend/src/components/common/ImageUpload.tsx` (import); `frontend/src/components/events/FormSection.tsx` (import) |
| `frontend/src/components/events/form-sections/EventTicketingSection.tsx` | None | `react` (import); `frontend/src/components/common/Input.tsx` (import); `frontend/src/components/events/FormSection.tsx` (import); `frontend/src/utils/url.ts` (import) |
| `frontend/src/components/events/FormSection.tsx` | `frontend/src/components/events/form-sections/EventBasicDetails.tsx:6` (import); `frontend/src/components/events/form-sections/EventLocationSection.tsx:5` (import); `frontend/src/components/events/form-sections/EventMediaSection.tsx:4` (import); `frontend/src/components/events/form-sections/EventTicketingSection.tsx:4` (import) | `react` (import); `frontend/src/components/common/Card.tsx` (import) |
| `frontend/src/components/events/MapPinAdjuster.tsx` | `frontend/src/components/events/form-sections/EventLocationSection.tsx:7` (import) | `react` (import); `@vis.gl/react-google-maps` (import); `frontend/src/types/index.ts` (import) |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G3. Legacy filters and location feed sharing date picker

**DEAD CODE CANDIDATE — 4 files; removal risk Medium.** No active page or middleware reaches this group. No dynamic import targets any member. EventFilters is exported by the unreachable events/index.ts barrel (G14); LocationInput has only that consumer. SingleDateRangePicker is shared by EventFilters and LocationFeed. Context explicitly says EventFilters was replaced by filter pills. Exact scaffold reference to EventFilters is historical. Removal is BLOCKED while its compatibility barrel export remains: separately approve removing only that export or KEEP G3. No broad barrel deletion. Verify seven-day map default, location timeframe boundaries, collection filters and mobile date controls.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/events/EventFilters.tsx` | `frontend/src/components/events/index.ts:3` (reexport) | `react` (import); `frontend/src/types/index.ts` (import); `frontend/src/lib/api.ts` (import); `frontend/src/components/common/Button.tsx` (import); `frontend/src/components/common/LocationInput.tsx` (import); `frontend/src/components/ui/SingleDateRangePicker.tsx` (import); `date-fns` (import) |
| `frontend/src/components/common/LocationInput.tsx` | `frontend/src/components/events/EventFilters.tsx:12` (import) | `frontend/src/components/maps/PlacesAutocomplete.tsx` (import) |
| `frontend/src/components/locations/LocationFeed.tsx` | None | `react` (import); `frontend/src/types/index.ts` (import); `frontend/src/components/events/EventCard.tsx` (import); `frontend/src/lib/api.ts` (import); `frontend/src/components/ui/SingleDateRangePicker.tsx` (import) |
| `frontend/src/components/ui/SingleDateRangePicker.tsx` | `frontend/src/components/events/EventFilters.tsx:13` (import); `frontend/src/components/locations/LocationFeed.tsx:5` (import) | `react` (import); `date-fns` (import); `react-day-picker` (import); `lucide-react` (import); `react-day-picker/dist/style.css` (import) |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G4. Old cluster marker and grouping type/helper

**DEAD CODE CANDIDATE — 2 files; removal risk Medium.** No active page or middleware reaches this group. No dynamic import targets any member. Only ClusterMarker imports EventGroup from grouping module, via import type. No active importer. Live GoogleMapView uses ClusteredEventMarkers and its internal marker implementation. Removing marker alone leaves grouping helper unused. Verify identical-location clusters, count/zoom interactions, invalid coordinates and map bounds.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/events/ClusterMarker.tsx` | None | `@vis.gl/react-google-maps` (import); `frontend/src/utils/groupEventsByLocation.ts` (import) |
| `frontend/src/utils/groupEventsByLocation.ts` | `frontend/src/components/events/ClusterMarker.tsx:9` (import) | `frontend/src/types/index.ts` (import) |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G5. Retired map presentation pieces

**DEAD CODE CANDIDATE — 5 files; removal risk Medium.** No active page or middleware reaches this group. No dynamic import targets any member. Five independent roots, no inbound edge or configuration loader found. They are grouped only by verification area and can be removed one per commit. Active accommodation ads, map UI, GoogleMiniMap/PlacesAutocomplete and GoogleMapView remain. Verify mobile/desktop map controls, pins and ad placement; shared Google Maps dependency remains active.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/events/AccommodationMap.tsx` | None | `react` (import) |
| `frontend/src/components/events/EventMarker.tsx` | None | `@vis.gl/react-google-maps` (import); `frontend/src/types/index.ts` (import) |
| `frontend/src/components/map/BottomSheet.tsx` | None | `react` (import); `lucide-react` (import) |
| `frontend/src/components/map/MapFilterBar.tsx` | None | `react` (import) |
| `frontend/src/components/maps/LocationPickerMap.tsx` | None | `react` (import); `@vis.gl/react-google-maps` (import) |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G6. Old spotlight card and HTML text helper

**DEAD CODE CANDIDATE — 2 files; removal risk Low–medium.** No active page or middleware reaches this group. No dynamic import targets any member. Only SpotlightCard imports stripHtml from stringUtils. Keep active OptimizedImage, Badge and formatPrice. Sanitisation is still required by master context: removing this plain-text helper must not remove DOMPurify or current HTML sanitisation. Verify location/event summaries and image fallbacks.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/locations/SpotlightCard.tsx` | None | `react` (import); `next/link` (import); `frontend/src/components/ui/OptimizedImage.tsx` (import); `frontend/src/types/index.ts` (import); `frontend/src/components/common/Badge.tsx` (import); `frontend/src/lib/stringUtils.ts` (import); `frontend/src/lib/formatPrice.ts` (import) |
| `frontend/src/lib/stringUtils.ts` | `frontend/src/components/locations/SpotlightCard.tsx:6` (import) | None |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G7. Old feed/card surfaces

**DEAD CODE CANDIDATE — 6 files; removal risk Low–medium.** No active page or middleware reaches this group. No dynamic import targets any member. Six independent unused roots; VenueCard has only an old scaffold path literal. Shared EventCard/Card/Badge/API/types stay reachable. Preserve active homepage curation/featured content, venue discovery, tags, event lists and promotions routes. Verify each area separately; remove one root per subcommit if preferred.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/events/EventHorizontalScroll.tsx` | None | `frontend/src/types/index.ts` (import); `frontend/src/components/events/EventCard.tsx` (import) |
| `frontend/src/components/home/FeaturedGrid.tsx` | None | `next/link` (import); `frontend/src/types/index.ts` (import); `frontend/src/components/events/EventCard.tsx` (import); `frontend/src/components/common/Button.tsx` (import) |
| `frontend/src/components/locations/CategorySwimlane.tsx` | None | `react` (import); `frontend/src/types/index.ts` (import); `frontend/src/components/events/EventCard.tsx` (import) |
| `frontend/src/components/promotions/PromotionCard.tsx` | None | `frontend/src/types/index.ts` (import); `frontend/src/components/common/Card.tsx` (import); `frontend/src/components/common/Badge.tsx` (import) |
| `frontend/src/components/tags/TagCloud.tsx` | None | `react` (import); `next/link` (import); `frontend/src/types/index.ts` (import); `frontend/src/lib/api.ts` (import) |
| `frontend/src/components/venues/VenueCard.tsx` | None | `next/link` (import); `frontend/src/types/index.ts` (import); `frontend/src/components/common/Card.tsx` (import); `frontend/src/components/common/Badge.tsx` (import) |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G8. Standalone social link renderer

**DEAD CODE CANDIDATE — 1 files; removal risk Low.** No active page or middleware reaches this group. No dynamic import targets any member. No inbound code or literal usage found. Current venue/organizer social URL handling remains in active code. Verify social links and protocol handling before deletion.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/common/SocialLinks.tsx` | None | `lucide-react` (import) |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G9. Unused hooks

**DEAD CODE CANDIDATE — 2 files; removal risk Low.** No active page or middleware reaches this group. No dynamic import targets any member. No inbound references. Live API/tag controls do not depend on these hooks. Verify scrolling/lazy content and tag selection; shared React/API/types stay active.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/hooks/useIntersectionObserver.ts` | None | `react` (import) |
| `frontend/src/hooks/useTags.ts` | None | `react` (import); `frontend/src/lib/api.ts` (import); `frontend/src/types/index.ts` (import) |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G10. Retired frontend Cloudinary/image helpers

**DEAD CODE CANDIDATE — 2 files; removal risk Low–medium.** No active page or middleware reaches this group. No dynamic import targets any member. No source imports into either helper. Cloudinary URL strings in config/backend/current imageOptimizer are active separate references. Keep Cloudinary backend service/dependency, remotePatterns, current OptimizedImage and imageOptimizer; stored legacy image URLs remain supported. Verify Cloudflare ID, Cloudinary URL and placeholder rendering before deletion.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/lib/cloudinary.ts` | None | None |
| `frontend/src/lib/images.ts` | None | None |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G11. Static location/image constants

**DEAD CODE CANDIDATE — 2 files; removal risk Low.** No active page or middleware reaches this group. No dynamic import targets any member. No imports or exact module-path references; generic locations/constants words are unrelated. Current PopularLocations uses API-backed hubs. Preserve location APIs/SSR/timeframe routes and assets referenced by live pages. Verify hub links and homepage categories.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/constants/locations.ts` | None | None |
| `frontend/src/lib/constants.ts` | None | None |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G12. Standalone error boundary

**UNCERTAIN — 1 files; removal risk Low if unused; behaviour risk medium.** No active page or middleware reaches this group. No dynamic import targets any member. No import; map.tsx declares a different inline ErrorBoundary and explicitly mentions a prior import build issue. Keep the standalone module until that history and expected reuse are confirmed. Do not refactor/replace the working inline boundary as part of cleanup.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/ui/ErrorBoundary.tsx` | None | `react` (import) |

**After removal:** No removal proposed; retain compatibility/uncertain code.

### G13. Unused skeleton barrel and implementation

**DEAD CODE CANDIDATE — 2 files; removal risk Low.** No active page or middleware reaches this group. No dynamic import targets any member. The barrel exports only Skeleton and has no consumers. Other “Skeleton” matches are comments or distinct active EventCardSkeleton, not this module. Remove the pair only after confirming no external source/barrel consumers; preserve active loading states.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/common/index.ts` | None | `frontend/src/components/common/Skeleton.tsx` (reexport) |
| `frontend/src/components/common/Skeleton.tsx` | `frontend/src/components/common/index.ts:1` (reexport) | None |

**After removal:** No further local source module outside this candidate set becomes orphaned. Internal chain companions are included above. Keep all active shared dependencies and packages. Approval requires fresh graph/literal/config checks, baseline type check, production build and the group-specific behaviour verification described above.

### G14. Compatibility barrels and wrappers

**COMPATIBILITY SAFEGUARD — 5 files; removal risk Low maintenance cost; unknown external removal risk.** No active page or middleware reaches this group. No dynamic import targets any member. Keep these five modules initially. VenueEditModal is an explicitly deprecated alias to required shared EditVenueModal; event CategoryFilterPills reexports the active category implementation. Barrels expose live maps/cards/selectors even though no local route imports barrels. No dynamic import reaches them. Preserve aliases pending source-consumer confirmation. G3 cannot be removed without addressing its EventFilters barrel export separately.

| File | Every confirmed inbound code edge | Every direct outbound module dependency |
|---|---|---|
| `frontend/src/components/events/index.ts` | None | `frontend/src/components/events/EventList.tsx` (reexport); `frontend/src/components/events/EventCard.tsx` (reexport); `frontend/src/components/events/EventFilters.tsx` (reexport); `frontend/src/components/events/DateFilterPills.tsx` (reexport); `frontend/src/components/events/CategoryFilterPills.tsx` (reexport); `frontend/src/components/events/GoogleMapView.tsx` (reexport) |
| `frontend/src/components/maps/index.ts` | None | `frontend/src/components/maps/GoogleMiniMap.tsx` (reexport); `frontend/src/components/maps/PlacesAutocomplete.tsx` (reexport) |
| `frontend/src/components/venues/index.ts` | None | `frontend/src/components/venues/VenueTypeahead.tsx` (reexport) |
| `frontend/src/components/events/CategoryFilterPills.tsx` | `frontend/src/components/events/index.ts:5` (reexport) | `frontend/src/components/categories/CategoryFilterPills.tsx` (reexport); `frontend/src/components/categories/CategoryFilterPills.tsx` (reexport) |
| `frontend/src/components/venues/VenueEditModal.tsx` | None | `frontend/src/components/venues/EditVenueModal.tsx` (reexport) |

**After removal:** No removal proposed; retain compatibility/uncertain code.

### Historical literal references beyond the import graph

The following exact name/path mentions survive in historical documents. They are evidence to preserve during documentation archival, not live consumers. Current-code comment/scaffold references are already noted in the group descriptions. A comparison of external package imports also found **no package imported exclusively by the 41 unreachable modules**: their imported packages still have live source consumers.

| Module | Historical literal locations | Interpretation |
|---|---|---|
| frontend/src/components/events/EventFilters.tsx | `_archive/docs/CURRENT_STATUS.md` lines 47; `_archive/docs/IMPLEMENTATION_PLAN.md` lines 167; `_archive/docs/plans/2025-12-09-phase2a-categories-tags-media-design.md` lines 409; `_archive/docs/plans/2025-12-09-phase2a-implementation-plan.md` lines 2527, 2536, 2537; `_archive/docs/plans/2025-12-11-phase-2.10-implementation.md` lines 161, 174, 269, 294, 296, 306, 1982, 1987, 2070, 2534; `_archive/docs/plans/2025-12-12-phase-2.10-remaining-work.md` lines 118, 168, 188 | Historical mention only; no route reachability |
| frontend/src/components/events/EventHorizontalScroll.tsx | `_archive/docs/phase2.41.md` lines 11 | Historical mention only; no route reachability |
| frontend/src/components/promotions/PromotionCard.tsx | `_archive/docs/CURRENT_STATUS.md` lines 50; `_archive/docs/IMPLEMENTATION_PLAN.md` lines 181 | Historical mention only; no route reachability |
| frontend/src/components/tags/TagCloud.tsx | `_archive/docs/plans/2025-12-09-phase2a-categories-tags-media-design.md` lines 396; `_archive/docs/plans/2025-12-09-phase2a-implementation-plan.md` lines 2126, 2129, 2131, 2133, 2145, 2211, 2212, 2584 | Historical mention only; no route reachability |
| frontend/src/components/venues/VenueCard.tsx | `_archive/docs/CURRENT_STATUS.md` lines 48; `_archive/docs/IMPLEMENTATION_PLAN.md` lines 173; `_archive/docs/PROJECT_STATUS_MASTER.md` lines 32 | Historical mention only; no route reachability |

### Active chains and master-context safeguards — KEEP

| Active chain / surface | Evidence and required behaviour |
|---|---|
| `pages/map.tsx` → dynamic `components/events/GoogleMapView.tsx` → `ClusteredEventMarkers.tsx` | Literal dynamic import resolves in graph; keep `ssr:false`, finite default date range, coordinate checks and responsive controls. No replacement with old G4/G5 components. |
| `pages/submit-event.tsx` → current event wizard → `wizard/StepTimeline.tsx` → `form-sections/EventScheduleSection.tsx` | Removing the whole form-sections directory would break live code. Keep current submission/edit behaviour, single-session limits, moderation and ticket-tier synchronisation. |
| `components/venues/EditVenueModal.tsx` → dynamic `maps/GoogleMiniMap.tsx`; admin venue manager/new/detail routes → maps/selectors | Shared venue editing is explicitly required. Old VenueEditModal filename is a compatibility alias, not authority to delete EditVenueModal. |
| `pages/collections/[slug].tsx` → `categories/CategoryFilterPills.tsx`; active DateFilterPills/EventCard/EventList | Context-required modular filtering persists independently from the old EventFilters module. Preserve collection analytics/geographic bounds and server SEO image resolution. |
| Active `OptimizedImage.tsx` → `utils/imageOptimizer.ts`; backend Cloudinary/Cloudflare services | Stored URLs and raw IDs survive helper cleanup. Preserve HTML sanitisation and brand/static paths. |
| All current Pages Router routes, middleware, `_app`, `_document`, 404/500 and SEO handlers | Framework/dynamic URL entrypoints are KEEP even with no component import. Preserve UUID/slug permanent redirects with query strings, SSR JSON-LD/canonical/OG output, auth/admin/organizer routes and compatibility URLs. |

Candidate totals: **35 DEAD CODE CANDIDATE files**, **5 COMPATIBILITY SAFEGUARD files**, **1 UNCERTAIN file**. G3's four files remain blocked by the retained barrel until an explicit export decision; this is not a 35-file immediate deletion recommendation. No public asset or npm dependency is a candidate merely because one of these source modules is unused.

## D. Operational, maintenance and historical scripts

The following register covers all 56 Python/TypeScript/SQL script files under the requested trees, including `__init__.py` as package infrastructure. Classifications use the user's categories. “Production-safe” means safe to execute against production; **no mutating tool is approved for unsupervised production execution**. Even read-only diagnostics may expose real identities and use a developer-specific environment. “No internal caller” does not rule out shell/manual scheduling. Routine active modules retain their current paths to minimise churn.

Replacement notes indicate functional overlap, not proof of safe equivalence. Migration-related scripts stay put for the dedicated migration audit even when they look superseded. Final location is exact; KEEP means no proposed relocation.

### Backend scripts (including existing archive)

| File | Classification | Purpose | Writes | Production-safe? | Replacement/overlap | Confirmed references | External dependency | Recommended final location |
|---|---|---|---|---|---|---|---|---|
| `backend/scripts/run_migrations.py` | ACTIVE AUTOMATED OPERATIONAL SCRIPT | Run sorted SQL ledger; user/collection DDL; slot/category/preference backfills | Data: Yes; schema: Yes | No standalone re-run without migration-state review | None; coexistence with Alembic is active | start.sh:12; release.sh:9; core/database.run_migrations via main.lifespan | Yes, release/start commands plus each application process | KEEP `backend/scripts/run_migrations.py` |
| `backend/scripts/migrate_uncategorized_venues.py` | ACTIVE AUTOMATED OPERATIONAL SCRIPT | Add venue city if absent; seed Uncategorized and recategorise unverified venues | Data: Yes; schema: Yes | Conditional operational code; changes existing categories | No equivalent replacement proven | scripts/run_migrations.py:122 | Indirect through startup/release | KEEP `backend/scripts/migrate_uncategorized_venues.py` |
| `backend/scripts/apply_constraints.py` | ACTIVE MANUAL MAINTENANCE TOOL | Add event duplicate and bookmark uniqueness constraints | Data: No direct DML; schema: Yes | No: locks/duplicates and broad exception handling require preflight | Overlaps Alembic baseline and deploy_fix; not equivalent | Self usage command only; no internal caller | Possible manual or release usage; confirm | KEEP `backend/scripts/apply_constraints.py` |
| `backend/scripts/cleanup_incorrect_nc500.py` | ACTIVE MANUAL MAINTENANCE TOOL | Remove nc500 associations outside current 10km criteria; adjust counts | Data: Yes with --apply; schema: No | Dry-run default; apply requires reviewed target snapshot | Complements tagging; no replacement proven | No internal caller; imports geographic constants/functions from app.api.events | Manual use plausible; confirm exact campaign policy | KEEP `backend/scripts/cleanup_incorrect_nc500.py` |
| `backend/scripts/tag_historical_nc500.py` | ACTIVE MANUAL MAINTENANCE TOOL | Backfill nc500 on historical events | Data: Yes with --apply; schema: No | Not proven: dry-run eligibility uses 25km; live apply function uses 10km, so previews overstate changes | Runtime apply_geographic_tagging in app/api/events.py; maintenance backfill still distinct | No internal caller; imports active API tagging logic | Manual use plausible; confirm before archive | KEEP `backend/scripts/tag_historical_nc500.py` |
| `backend/scripts/cutover_images.py` | HISTORICAL RECOVERY TOOL | Upload old Cloudinary images to Cloudflare and replace image column values with IDs | Data: Yes + cloud uploads; schema: No | No: no dry-run; concurrent per-row operations, partial success and orphan uploads possible | Current upload services handle new uploads; historical cutover not replaced | No internal caller; calls active cloudflare service | Operator-run migration possible; retain mapping chain | KEEP `backend/scripts/cutover_images.py` |
| `backend/scripts/sync_live_db.py` | HISTORICAL RECOVERY TOOL | Apply table/row/column Cloudflare ID mapping using raw SQL | Data: Yes; schema: No | No: mapping controls identifiers; no dry-run; default lookup misses archived mapping path | cutover_images uploads directly; not equivalent to recovery replay | Reads db_cf_mapping.json from cwd/script/backend; actual file in _archive/migration_artefacts; archive/extract_mapping produces same named artefact | Manual recovery dependency plausible; preserve both tool and mapping | KEEP `backend/scripts/sync_live_db.py` |
| `backend/scripts/merge_duplicates.py` | ACTIVE MANUAL MAINTENANCE TOOL | Merge same-title/start events at nearby venues and reassign selected related rows | Data: Yes with --apply; schema: No | No production approval: dry-run default; apply references retired hero_slots and omits native ticket/order migration handling | Runtime duplicate detection prevents some new duplicates; not a historic merge replacement | No internal caller; imports active models plus raw featured_bookings/hero_slots SQL | Manual repair plausible; payment/FK audit mandatory | KEEP `backend/scripts/merge_duplicates.py` |
| `backend/scripts/fix_admin_user.py` | UNKNOWN EXTERNAL DEPENDENCY | Activate all inactive/null-active admin users from DATABASE_URL | Data: Yes; schema: No | No: can reactivate intentionally disabled admins, no dry-run | No safe replacement established | Self documentation says Render Shell/release; no internal caller | MUST confirm current release/manual use | KEEP `backend/scripts/fix_admin_user.py` |
| `backend/scripts/archive/add_map_fields_local.py` | SUPERSEDED SCRIPT | Add legacy map display columns to hardcoded SQLite DB | Data: No; schema: Yes | No: environment/path specific | Current metadata/legacy migration history owns fields | No internal caller | Historical manual use; confirm before changing path | KEEP `backend/scripts/archive/add_map_fields_local.py` |
| `backend/scripts/archive/debug_enum.py` | DANGEROUS DEBUG / TEST UTILITY | Print enum definitions | Data: No; schema: No | Read-only source; imports still require correct environment | Superseded diagnosis; no operational replacement needed | No internal caller | No schedule proven; retain in existing archive | KEEP `backend/scripts/archive/debug_enum.py` |
| `backend/scripts/archive/debug_rising.py` | DANGEROUS DEBUG / TEST UTILITY | Diagnose unverified/rising venue query | Data: No; schema: No | Read-only query but real DB/identity exposure | Current admin rising-locations API is active; not a diagnostic replacement | No internal caller | Manual history unknown | KEEP `backend/scripts/archive/debug_rising.py` |
| `backend/scripts/archive/main_legacy_migrations.py` | SUPERSEDED SCRIPT | Snapshot of old startup DDL and venue status normalisation | Data: Yes; schema: Yes | NO: historical blanket status updates; not executable maintenance contract | Extracted from former main lifespan; current migration mechanisms overlap | File header explicitly says saved for reference; no caller | Historical deployment evidence; retain source in place | KEEP `backend/scripts/archive/main_legacy_migrations.py` |
| `backend/scripts/archive/migrate_venues_status.py` | SUPERSEDED SCRIPT | Add venue status then mark old unverified venues verified | Data: Yes; schema: Yes | NO: can grant verification to wrong records | Current model/migration status handling; historical semantics differ | No internal caller | Former manual schema tool; unproven external path | KEEP `backend/scripts/archive/migrate_venues_status.py` |
| `backend/scripts/archive/run_migrations.py` | SUPERSEDED SCRIPT | Old runner adds Google place ID/unique index | Data: No; schema: Yes | No: old scope/assumptions | backend/scripts/run_migrations.py is current runner, not byte-identical equivalent | No exact archived-path caller; same-name matches to active runner are not references to this file | External full path must be checked | KEEP `backend/scripts/archive/run_migrations.py` |
| `backend/scripts/archive/run_migrations1.py` | SUPERSEDED SCRIPT | Older runner adds hero override image and Google place fields | Data: No; schema: Yes | NO: retired hero_slots schema assumption | Current runner/metadata supersede operational role, not history | No exact caller | External full path must be checked | KEEP `backend/scripts/archive/run_migrations1.py` |

### Application operational package

| File | Classification | Purpose | Writes | Production-safe? | Replacement/overlap | Confirmed references | External dependency | Recommended final location |
|---|---|---|---|---|---|---|---|---|
| `backend/app/scripts/backfill_preferences.py` | ACTIVE AUTOMATED OPERATIONAL SCRIPT | Create missing UserPreferences in committed batches | Data: Yes; schema: No | Conditional; race/partial completion review needed | No replacement proven | scripts/run_migrations.py:113–114 | Indirect through startup/release; documented manual command too | KEEP `backend/app/scripts/backfill_preferences.py` |
| `backend/app/scripts/migrate_slot_pricing.py` | ACTIVE AUTOMATED OPERATIONAL SCRIPT | Create slot_pricing table and seed missing slot prices | Data: Yes; schema: Yes | Pricing-sensitive; preserve current operation | No replacement proven | release.sh:12; scripts/run_migrations.py:104 | Yes, direct release and indirect startup | KEEP `backend/app/scripts/migrate_slot_pricing.py` |
| `backend/app/scripts/__init__.py` | ACTIVE AUTOMATED OPERATIONAL SCRIPT | Package marker for operational module imports | Data: No; schema: No | Yes as package infrastructure; not a standalone job | Not applicable | Python package/module resolution for the app.scripts tools | Indirect through python -m app.scripts.* | KEEP `backend/app/scripts/__init__.py` |
| `backend/app/scripts/expire_featured.py` | UNKNOWN EXTERNAL DEPENDENCY | Expire unpaid bookings after 15 minutes; complete ended bookings; sync event featured flags | Data: Yes; schema: No | Not proven; commerce-sensitive status/flag transitions | app/api/cron.py has related operational logic; equivalence not established | Docstring says every five minutes; historical cron output references module; no internal scheduler found | MUST confirm cron/Render worker before any path change | KEEP `backend/app/scripts/expire_featured.py` |
| `backend/app/scripts/migrate_add_trusted_organizer.py` | HISTORICAL RECOVERY TOOL | Add trusted-organizer column and create FeaturedBooking table | Data: No explicit DML; schema: Yes | No automatic execution approval; schema-state dependent | Current metadata/baseline overlap, completion unproven | Self python -m usage only | Former deployment/manual migration possible | KEEP `backend/app/scripts/migrate_add_trusted_organizer.py` |
| `backend/app/scripts/migrate_featured_subtitle.py` | HISTORICAL RECOVERY TOOL | Add featured booking custom_subtitle column | Data: No; schema: Yes | No automatic execution approval | Current model/baseline overlap; exact deployment state unknown | Self python -m usage only | Former manual migration possible | KEEP `backend/app/scripts/migrate_featured_subtitle.py` |
| `backend/app/scripts/seo_migration.sql` | HISTORICAL RECOVERY TOOL | Add SEO/slug columns and partial unique indexes on events/venues | Data: No; schema: Yes | No: index names overlap later history with different uniqueness intent | Alembic baseline/current models overlap; not proven equivalent | No auto-glob: located outside backend/migrations/*.sql | Manual SQL execution may be historical dependency | KEEP `backend/app/scripts/seo_migration.sql` |

### Scratch

| File | Classification | Purpose | Writes | Production-safe? | Replacement/overlap | Confirmed references | External dependency | Recommended final location |
|---|---|---|---|---|---|---|---|---|
| `backend/scratch/test_event_update_moderation.py` | DANGEROUS DEBUG / TEST UTILITY | Use existing user/event; edit moderation/venue, delete featured bookings, create/delete test booking | Data: Yes, including existing records; schema: No | NO; configured engine, hardcoded path, unsafe test discovery | Current isolated moderation/publishing tests cover parts only | No confirmed caller; pytest filename discovery is an implicit entrypoint | Confirm no manual dependency; prohibit production invocation | ARCHIVE to `backend/scripts/archive/debug/test_event_update_moderation.py.disabled` after Batch 3 approval |

### Node maintenance

| File | Classification | Purpose | Writes | Production-safe? | Replacement/overlap | Confirmed references | External dependency | Recommended final location |
|---|---|---|---|---|---|---|---|---|
| `scripts-node/recover_venues.ts` | ACTIVE MANUAL MAINTENANCE TOOL | Fuzzy-match orphan events to venue IDs and update individually | Data: Yes; schema: No | NO: executes main; no dry-run/whole transaction, score-zero exclusion; wrong dotenv path | No replacement established; generator creates different records | scripts-node/package.json npm start; pg/Fuse/dotenv imports | Operator workflow likely; confirm invocation cwd/environment; do not run npm start | KEEP `scripts-node/recover_venues.ts` |
| `scripts-node/auto_generate_venues.ts` | ACTIVE MANUAL MAINTENANCE TOOL | Group orphan location names, reuse MAX event coordinates, insert UNVERIFIED venues and link events | Data: Yes; schema: No | NO: no dry-run; insert/link partial failure, coordinates can come from different rows; cwd dotenv assumption | recover_venues matches existing rows; not equivalent | No caller; pg/uuid/dotenv; main called at module scope | Manual workflow plausible; confirm prior result/mapping | KEEP `scripts-node/auto_generate_venues.ts` |

### Local archive

| File | Classification | Purpose | Writes | Production-safe? | Replacement/overlap | Confirmed references | External dependency | Recommended final location |
|---|---|---|---|---|---|---|---|---|
| `archive/check_data.py` | HISTORICAL RECOVERY TOOL | Inspect event/user ID/data relationships | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/check_data.py` |
| `archive/check_data_v2.py` | HISTORICAL RECOVERY TOOL | Exact duplicate of check_data.py | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | check_data.py is retained counterpart | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/check_data_v2.py` |
| `archive/check_formats.py` | HISTORICAL RECOVERY TOOL | Inspect stored identifier formats | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/check_formats.py` |
| `archive/check_integrity.py` | HISTORICAL RECOVERY TOOL | Inspect relational/identifier integrity | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/check_integrity.py` |
| `archive/check_short_ids.py` | HISTORICAL RECOVERY TOOL | Inspect shortened/nonstandard IDs | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/check_short_ids.py` |
| `archive/check_types.py` | HISTORICAL RECOVERY TOOL | Inspect database identifier types | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/check_types.py` |
| `archive/debug_attendance.py` | HISTORICAL RECOVERY TOOL | Inspect attendance via ORM | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/debug_attendance.py` |
| `archive/debug_attendance_v2.py` | HISTORICAL RECOVERY TOOL | Inspect attendance via raw SQL | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/debug_attendance_v2.py` |
| `archive/detailed_data_check.py` | HISTORICAL RECOVERY TOOL | Expanded ID/data diagnostics | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/detailed_data_check.py` |
| `archive/final_count.py` | HISTORICAL RECOVERY TOOL | Count records after historical repair | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/final_count.py` |
| `archive/final_diagnostic.py` | HISTORICAL RECOVERY TOOL | Final historical relationship diagnostics | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/final_diagnostic.py` |
| `archive/follow_the_user.py` | HISTORICAL RECOVERY TOOL | Trace records for a fixed historical account | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/follow_the_user.py` |
| `archive/test_schema.py` | HISTORICAL RECOVERY TOOL | Inspect information-schema/type state | Data: No; schema: No | Read-only operations; configured DB and hardcoded local env paths make portable use unproven | No proven replacement; overlapping checks are not exact duplicates | No exact caller; generic test_db/function words elsewhere are unrelated | Manual use unknown; keep until owner confirms | KEEP `archive/test_schema.py` |
| `archive/backfill_slugs.py` | HISTORICAL RECOVERY TOOL | Generate missing event/venue slugs and commit | Data: Yes; schema: No | No: URL stability/collision review required | Current runtime slug generation only covers its normal flows | No internal caller | Historical repair possible; preserve URL history | KEEP `archive/backfill_slugs.py` |
| `archive/create_admin_user.py` | DANGEROUS DEBUG / TEST UTILITY | Create or promote fixed admin identity using embedded setup credentials | Data: Yes; schema: No | NO; fixed identity/password and privilege mutation | fix_admin_user activates existing admins only; not equivalent | No caller; root ignore also names a former backend/create_admin_user.py path | Possible old onboarding workflow; do not publish embedded credential material | KEEP `archive/create_admin_user.py` |
| `archive/extract_mapping.py` | HISTORICAL RECOVERY TOOL | Read image ID columns and write db_cf_mapping.json | Data: No DB DML; writes local file; schema: No | Read-only DB; mapping file can be sensitive and overwritten | No replacement proven | Output filename consumed by backend/scripts/sync_live_db.py; no invocation caller | Historical image-recovery chain; preserve | KEEP `archive/extract_mapping.py` |
| `archive/structure.py` | DANGEROUS DEBUG / TEST UTILITY | Original scaffolder writes app/config files, creates venv, installs packages and initialises/stages/commits Git | Data: No direct DB run; writes a seed program; schema: No direct DB DDL run; generates schema code | NO; import-time filesystem/package/Git mutation could overwrite project | Current repository fully replaces scaffold role | No exact script caller; ordinary word structure is not a reference | Historical generator only; never execute to repair clone | KEEP `archive/structure.py` |
| `archive/sync_tags.py` | HISTORICAL RECOVERY TOOL | Read legacy tags field, normalise Tag/EventTag and recalculate counts | Data: Yes; schema: No | NO: legacy column/data assumptions and broad commits | Current tag APIs are not a recovery replacement | No caller | Manual data repair history possible | KEEP `archive/sync_tags.py` |
| `archive/test_api.py` | DANGEROUS DEBUG / TEST UTILITY | At module import select real user/event, override auth and POST attendance | Data: Yes via API; schema: No direct DDL | NO; import-time mutation of existing attendance | Current tests are not an exact attendance replacement | pytest filename discovery; no explicit caller | Unknown manual use; keep archived and exclude discovery | KEEP `archive/test_api.py` |
| `archive/test_db.py` | DANGEROUS DEBUG / TEST UTILITY | At module import change attendance/count then attempt cleanup | Data: Yes; schema: No | NO; stale app.db.session import currently fails, but fixing import would enable writes | No replacement proven | pytest discovery; test_db fixtures elsewhere are unrelated references | Historical manual tool; failed import is not safety assurance | KEEP `archive/test_db.py` |
| `archive/test_slug_migration.py` | DANGEROUS DEBUG / TEST UTILITY | Test copied slug algorithm using mocks/local values | Data: No; schema: No | No DB operations found; isolated legacy algorithm, not current production test | Current slug implementation differs/needs own tests | pytest filename discovery, no other caller | No scheduling shown; keep historical, exclude normal suite | KEEP `archive/test_slug_migration.py` |
| `archive/verify_counts.py` | DANGEROUS DEBUG / TEST UTILITY | Insert organizer/events into configured DB, query count then delete fixtures | Data: Yes; schema: No | NO; commits and incomplete cleanup on failures possible | Current organizer tests cover different behaviours | No caller; direct main guard | Manual debug history only, external use unproven | KEEP `archive/verify_counts.py` |
| `archive/verify_final.py` | DANGEROUS DEBUG / TEST UTILITY | At module import impersonate real user and toggle event attendance twice | Data: Yes via API; schema: No direct DDL | NO; two toggles are not a safe rollback if anything fails | No exact replacement proven | No caller; import itself executes | Manual debug history only | KEEP `archive/verify_final.py` |

### Historical archive

| File | Classification | Purpose | Writes | Production-safe? | Replacement/overlap | Confirmed references | External dependency | Recommended final location |
|---|---|---|---|---|---|---|---|---|
| `_archive/scripts/deploy_fix.py` | UNKNOWN EXTERNAL DEPENDENCY | Delete duplicate events, then add uniqueness constraint if absent | Data: Yes, deletes events; schema: Yes | NO; dependent records/payment history not explicitly preserved; no dry-run | apply_constraints adds constraint only; merge_duplicates has different repair semantics | Docstring: Render release `python scripts/deploy_fix.py`; that former path is absent | MUST confirm Render release/predeploy; do not infer it is unused | KEEP `_archive/scripts/deploy_fix.py` |
| `_archive/scripts/emergency.py` | UNKNOWN EXTERNAL DEPENDENCY | Minimal fallback FastAPI health app | Data: No; schema: No | Read-only stub; serving it could mask missing application | Main FastAPI is real app; stub not functionally equivalent | No confirmed repository launcher | Check old deployment/health worker commands before archive changes | KEEP `_archive/scripts/emergency.py` |
| `_archive/scripts/hunt_id.py` | HISTORICAL RECOVERY TOOL | Search tables for a specific historical ID | Data: No; schema: No | Read-only DB queries; schema/identity assumptions | No replacement proven | No caller | Manual forensic history possible | KEEP `_archive/scripts/hunt_id.py` |
| `_archive/scripts/parse_migration_log.py` | HISTORICAL RECOVERY TOOL | Parse migration log into migration_mapping.json at historical paths | Data: No DB DML; writes file; schema: No | No DB use; local hardcoded paths/output overwrite risk | No replacement proven | Reads migration.log; produces companion mapping; files now archived | Image recovery provenance; no scheduler found | KEEP `_archive/scripts/parse_migration_log.py` |
| `_archive/scripts/reproduce_issue.py` | DANGEROUS DEBUG / TEST UTILITY | Set SQLite URL then create schema/test users/venues/events and exercise upsert | Data: Yes; schema: Yes via create_all | NO production use; standalone env override is safer but not robust to prior imports or service side effects | Current service/tests are not equivalent reproduction | No caller; main guard; backend path depends on cwd | Historical debug only; retain/exclude normal suite | KEEP `_archive/scripts/reproduce_issue.py` |
| `_archive/scripts/reproduce_venue_error.py` | DANGEROUS DEBUG / TEST UTILITY | Set SQLite URL, create admin/schema then call admin import with missing venue | Data: Yes; possible external service work through import; schema: Yes via create_all | NO; local reproduction, incomplete cleanup, current services may do external work | Current ingestion tests absent; no replacement proven | No caller; imports active admin_import API; cwd-sensitive | Historical debug only; retain | KEEP `_archive/scripts/reproduce_venue_error.py` |
| `_archive/scripts/simple_test.py` | DANGEROUS DEBUG / TEST UTILITY | Read organizer and count distinct published event titles | Data: No; schema: No | Read-only query against configured engine; not isolated automated test | Current organizer API count logic; no exact automated replacement | No caller; main guard | Manual diagnostic history only | KEEP `_archive/scripts/simple_test.py` |

### Important script decisions

* Keep `expire_featured.py` exactly where it is. Its five-minute schedule is documentation, not proof a job exists. Related cron endpoint logic does not prove equivalent expiry/flag synchronisation. Confirm job ownership, last successful run and exact command without running the tool.
* Keep both image repair tools and `_archive/migration_artefacts/` together as a dependency set. `sync_live_db.py`'s default searches do not find the archived map. `extract_mapping.py` is a producer, not an inbound invocation dependency. No repair is attempted here.
* NC500 cleanup uses 10km; tagging preview uses 25km while applying the live 10km function. A “dry-run” count is not a dependable apply preview. Do not reconcile logic as cleanup.
* Duplicate merge applies raw SQL to `hero_slots`, a table removed by SQL migration 002, and does not enumerate current native order/ticket/tier references. It needs dedicated data/payment safety review before execution. The old deploy bridge deletes events rather than preserving all child data. Neither is a substitute for the other.
* All 56 sources are retained in this phase. The only proposed script relocation is the dangerous scratch file into a non-discoverable historical filename after Batch 3 approval and secret/path review. Existing archived scripts stay in their existing trees initially; create an operations index to explain them instead of moving every tool.

Additional historical reference: `_archive/docs/plans/2025-12-28-email-engine-implementation.md` names `backfill_preferences.py` at lines 1259, 1263, 1270, 1285, 1314, 1321 and 1327. This supplements its confirmed active SQL-runner call, rather than suggesting it is historical-only. Same-name matches for `run_migrations`, `test_db`, `structure` and `__init__` were distinguished from actual path/invocation references.

## E. Migration safety — KEEP all migration mechanisms

### Actual automatic entrypoints and ordering

1. **`backend/start.sh`**: `set -e` → `alembic upgrade head` → `python scripts/run_migrations.py` → uvicorn. A command failure prevents serving through this script.
2. **`backend/release.sh`**, if Render uses it: Alembic → SQL runner → `python -m app.scripts.migrate_slot_pricing`. Slot pricing also runs inside the SQL runner, so this entrypoint repeats it.
3. **Every application lifespan**, including uvicorn started directly by compose or context-managed TestClient: check configured database connectivity → `SQLModel.metadata.create_all(engine)` → core database wrapper loads the SQL runner → inline PostgreSQL migrations (skipped for SQLite). Connection/initialisation exceptions are logged; portions permit serving afterward. This route does not run Alembic itself.
4. **SQL runner internals**: create/check `schema_migrations` → sort the eight `backend/migrations/*.sql` filenames → execute missing ledger entries and record/commit each → unledgered user activation-column/ban repair and collection-bound DDL → slot pricing → preference backfill → uncategorised venue migration. Some helper failures are caught individually. Enum ADD VALUE scripts use autocommit, so a whole release is not one transaction.
5. **Inline migrations**: DDL/indexes/extensions and data backfills run again during lifespan without a per-revision ledger. They include pg_trgm/title index, event website/all-day/recurrence/cancellation fields, venue dismissed, analytics, created_at backfill, user last-login/admin notes, organizer fields and collection analytics/bounds. A caught failed statement can leave a PostgreSQL transaction aborted unless rolled back, so subsequent statements may also fail.

**Do not change order, locations, revision IDs, table models or ledger files in cleanup.** Running Alembic and startup simply to inspect the plan would itself mutate. `create_all` can create missing tables but cannot upgrade existing ones or resolve historical migration assumptions. `alembic/env.py`'s autogeneration filter excludes reflected unmanaged objects; it does not stop explicit DROP operations already written in the baseline.

### Current source revision chain

Seventeen present revisions form one connected source chain. This is a static source finding, not the revision deployed in any environment:

```text
2b4255d70229 -> 6daaeeecd963 -> 8a699a46d724 -> 257747883830
 -> f506de5cf913 -> c6a141c8f560 -> ecae8676089f -> e40d1624dc85
 -> 869936c87afe -> 9c316f37862e -> e9b6ba72632d -> a1b2c3d4e5f6
 -> b2c3d4e5f6a7 -> c3d4e5f6a7b8 -> d4e5f6a7b8c9
 -> e5f6a7b8c901 -> f6a7b8c90123
```

Six source-less cached revision identifiers are `37290838eb8d`, `45c6a4346817`, `cf12601a93d6`, `e66034878947`, `f638b69b0c39`, `fd20df60ffec`. They concern pending-event/native-ticketing work according to cache filenames. None is a `down_revision` of the present chain, so missing files do not by themselves prove the current source chain is broken. They matter if any deployed database is stamped at one of them or historical recovery needs them. Preserve the exact cached files in B and obtain deployed state before deciding; do not recreate revisions from their names.

### Overlap and replay risks

| Area | Overlapping mechanisms | Risk / decision |
|---|---|---|
| Baseline bootstrap | Alembic `2b4255d70229` alters a preexisting schema; start runs it before metadata creation | Empty DB fails on absent checkins index/table before application startup. Its source commit description says baseline/stamp, supporting an existing-database origin; that is not a portable bootstrap contract. Dedicated bootstrap plan required. |
| SQL ledger | Baseline explicitly drops schema_migrations; SQL runner creates it | An unstamped environment running that baseline can lose skip history and replay SQL. Do not stamp or drop/recreate ledger to “repair” it. |
| SQL 001–006 | Dismissed field; hero_slots teardown; preference columns; premium enum variants; account-specific booking purge | These are historical DDL/DML, not disposable scripts. SQL 006 removes selected CANCELLED/COMPLETED featured_bookings for one hard-coded account; no identity is reproduced here. Data retention/payment reconciliation must precede any replay. |
| Collection counters | SQL 007, Alembic e5f6a7b8c901, inline migrations | IF NOT EXISTS guards do not establish matching types/defaults/backfill semantics. Confirm deployed columns and ledger. |
| Collection geographic bounds | SQL 008, Alembic f6a7b8c90123, inline migrations and SQL runner's unledgered tail | Repeated ALTERs across startup paths; deployment state and locking/concurrency risk. |
| Event cancellation/reschedule | Alembic b2c3d4e5f6a7 and inline DDL | Similar fields do not justify removing either mechanism while deployments may enter through different paths. |
| Slot pricing/preferences/venue categories | SQL runner helpers, explicit release slot seed, metadata creation | Repeated commits can race across workers. Existing pricing/category values and partial completion require review; no seed deletion. |
| Trigram/slug/uniqueness indexes | Baseline index operations; inline pg_trgm index; historical SEO unique slug SQL and constraint repair tools | Named-index existence is not proof of semantic equivalence. Baseline drops a trigram index later recreated inline; slug index uniqueness differs across history. |
| Older migration runners | backend/scripts/archive variants versus active runner | Similar names, different SQL. Archive sources are evidence; start/release reference active path only. |
| Failure/concurrency | release plus start plus per-worker lifespan; autocommit enum operations; caught helper errors | Partially applied changes, duplicate work and apparent healthy startup despite drift. Current deployment topology decides actual exposure. |

Production questions remaining after Craig confirmed deployed commit `69d1966`: `alembic_version`; full SQL filename ledger; whether any source-less revision was ever deployed; how baseline was originally stamped/bootstrapped; existence/types/defaults/indexes of overlapping columns; pg_trgm privilege; worker/replica startup concurrency; whether SQL 006 has already run and applicable retention records. These require an authorised, read-only production-state inspection plus backup/restore evidence. A deployed code commit does not prove the database reached its migration head. No database inspection was performed here. Migration remediation is a separate task, not any of Batches 1–5.

## F. Testing and verification readiness

### Backend

There are **17 test modules with 84 statically defined `test_*` functions**, plus `backend/tests/conftest.py`. This count is not collected/parameterised test count and not a result. Framework: pytest, FastAPI TestClient/httpx, SQLModel/SQLAlchemy fixtures and unittest.mock. An async test uses `pytest.mark.asyncio`; pytest and pytest-asyncio need explicit development dependencies. Installed/global historical pytest plugins (including django/env in logs) are not a supported project dependency contract.

| Source | Static test functions | Coverage indicated by source |
|---|---|---|
| backend/tests/test_auto_seller_verification.py | 3 | db fixture; automatic seller verification on stripe sync; admin seller oversight directory and moderation |
| backend/tests/test_cancellation_and_reschedule.py | 3 | db fixture; event cancellation service and refunds; scanner lockdown on cancelled event |
| backend/tests/test_checkout.py | 5 | db fixture; checkout create payment intent event lookup and paths; intent status from db; intent status fallback not found; buyer orders endpoint |
| backend/tests/test_collections.py | 12 | db fixture; collection enable venue filter; collection organizer profile ids filter; collection organizer profile ids strict and isolation; api events organizer profile ids strict isolation; collection slug uniqueness and error handling; list collections include inactive; collection slug returns preaggregated venues; collection track view and click; map events strict organizer isolation; collection empty date coercion; collection bounding box filtering |
| backend/tests/test_event_moderation_queue.py | 7 | db fixture; first time organizer update triggers review and report; untrusted existing organizer update reason; profanity event creates report in queue; admin resolve report publishes event; admin moderate event resolves report; moderation queue and admin events pending parity |
| backend/tests/test_event_ticket_tiers.py | 3 | create and update event ticket tiers; parse price input standard events; derive event price from tiers |
| backend/tests/test_fee_service.py | 8 | standard fee; pass fees to buyer; dynamic custom fee settings; first time poster fee; pro poster fee; hard cap fee; zero price no fee; promo discount percentage |
| backend/tests/test_fee_settings_api.py | 2 | db fixture; admin fee settings endpoints |
| backend/tests/test_location_hubs.py | 2 | db fixture; location hub crud endpoints |
| backend/tests/test_operational_safeguards.py | 6 | db fixture; automated ticket sales cutoff past sale end; automated ticket sales cutoff fallback to event date start; anti overselling validation; admin order search and email typo fixer; native ticketing single session and duration validation |
| backend/tests/test_organizer_invoices.py | 3 | db fixture; organizer invoices and tax export; organizer hub events and attendees export |
| backend/tests/test_private_beta_ticketing_gating.py | 7 | db fixture; non admin allowed stripe onboarding; non admin allowed seller request access; non admin allowed creating event with ticket tiers; non admin allowed direct tier management for own event; non admin blocked from managing other users event tiers; single session and 36h constraint enforced for standard users |
| backend/tests/test_scanner.py | 2 | db fixture; scanner activation and validation |
| backend/tests/test_sellers.py | 8 | db fixture; seller status and onboarding flow; standard non admin onboarding without organizer; standard non admin onboarding with dashed uuid; standard non admin onboarding with slug; standard non admin onboarding fallback on unowned or missing id; standard non admin group member onboarding; standard non admin dashboard link |
| backend/tests/test_streamlined_event_publishing.py | 4 | db fixture; clean event submission instant publishing; profanity event quarantine in pending review; admin new event notification ticketed and standard templates |
| backend/tests/test_terms_acceptance.py | 5 | db fixture; standard free event without ticketing succeeds without terms; ticketed event without terms acceptance rejected; ticketed event with terms acceptance succeeds; enabling ticketing on event update requires terms |
| backend/tests/test_webhooks.py | 4 | db fixture; stripe connect webhook payment intent succeeded; standard stripe webhook coexists; stripe connect webhook organizer notifications and email |

Most database fixtures use in-memory SQLite with StaticPool and override `get_session`. JSONB compilation is translated to JSON for SQLite. This makes basic handler/business tests feasible, but it does not exercise PostgreSQL enums, JSONB operators, pg_trgm, PostGIS, date/time handling, isolation/locks, row-level contention, index semantics or Alembic/SQL-ledger startup. SQLite foreign-key enforcement is not enabled by the shown fixtures, so PostgreSQL cascade/integrity behaviour cannot be inferred.

**Critical isolation gap:** `test_scanner.py:38`, `test_organizer_invoices.py:39` and `test_cancellation_and_reschedule.py:45` use `with TestClient(app)`. Lifespan calls global `app.main.engine`, direct migration helpers and a direct `next(get_session())`; request-level `app.dependency_overrides` does not redirect those calls. Modules import application/config before test fixture setup, and common conftest does not set a safe DATABASE_URL before those imports. Never run even the current suite with developer/production credentials present. This is separate from the dangerous scratch/archive tests. Some plain TestClient users avoid lifespan and therefore also fail to verify real startup.

`conftest.py` usefully mocks Resend and SMTP SDK/service calls. Several ticketing tests mock Stripe account, intent, refund and webhook methods. Those specific patches do not prove complete network isolation for every path. Require dummy keys and a network-deny test boundary so an unmocked Stripe/email/Cloudflare call fails locally instead of reaching an account. Do not use real payment credentials or “small real test payments”. Test-mode Stripe should only be used in a separate explicitly approved integration exercise.

Missing source is evidenced for buyer refund, cron, featured and health tests by bytecode/logs, with no matching source in current tree or locally available history search. Do not count them as current coverage. Priority gaps before risky cleanup: safe startup/global-engine isolation; empty/existing PostgreSQL migration fixtures; full buyer-initiated refund/expiry/idempotency/overselling concurrency; actual authentication and group/venue permissions; unauthenticated debug-route protection; end-to-end public ticketing/terms/scanner lifecycle; SSR redirect/canonical/OG and date/map behaviour. Existing tests cover pieces of these; the gap is integrated regression assurance rather than a claim no related assertions exist.

Also note `backend/app/api/cron.py` accepts a hard-coded fallback cron secret if `CRON_SECRET_KEY` is unset. Confirm a non-default secret in deployment; route/auth hardening belongs with the separate security task, not cosmetic cleanup.

### Frontend

* `frontend/playwright.config.ts` targets empty `./tests`, uses Chromium/Firefox/WebKit, parallel execution, CI retry settings and HTML reports. `baseURL` and `webServer` are commented out. `@playwright/test` is declared; test-source availability and installed browser binaries are separate prerequisites.
* Historical report, contexts and `captured_e2e.txt` name `tests/promotions.spec.ts` and show all three browsers failing login with HTTP 429. No such source exists now; local available Git history search returned no frontend/tests source. Preserve reports until provenance/replacement coverage is agreed. Do not claim `npm test` works: only dev/build/start are defined.
* TypeScript 5.9.3 is available as a declared development dependency. Use installed compiler with `--noEmit --incremental false` for a source check. `next-env.d.ts` imports generated `.next/types/routes.d.ts`, so fresh-clone type checking may first need route type generation. Local Next CLI source confirms a `typegen` command; run it only in an approved isolated checkout because it produces files and loads Next configuration.
* Production build exists as `next build --webpack`, but deliberately ignores TypeScript errors and generates PWA files. Build success does not imply type success. There is no configured usable lint baseline: no direct ESLint dependency/config or lint script, and current Next CLI has no lint command. Record this gap rather than inventing a passing lint result.

### Minimum verification contracts for later approved batches

| ID | Verification | Safe execution conditions / acceptance |
|---|---|---|
| V0 | Git status/diff and exact-path/hash comparison | Every batch: record base commit and preexisting changes, stage only authorised paths, inspect staged diff/whitespace, compare all protected source/config hashes. Ignored/untracked archives need separate private byte-preserving backup because Git cannot roll them back. |
| V1 | Reproducible dependency/config check | Batch 0: clean disposable checkout, matching Node/Python versions, screened templates, `npm ci`, backend install from approved manifest, package-lock consistency. No npm start in scripts-node. No live env files copied. |
| V2 | Frontend type check | From isolated frontend checkout: installed `next typegen` if generated types absent, then installed `tsc --noEmit --incremental false`. Record preexisting diagnostics; accept no new diagnostics, with affected-code failures resolved before risky cleanup. A baseline already failing relevant routes blocks those groups. |
| V3 | Frontend production build/start | From same isolated checkout with dummy/test settings and safe backend/fixtures: npm build then installed Next start with explicit port. PWA generated files expected only locally. Compare SSR HTML and route responses. No live credentials; no deployment implied. |
| V4 | Backend source/import/startup checks | First static AST parse without importing app. Import only in a subprocess with dummy settings and isolated engine environment established BEFORE imports. Startup explicitly performs migrations, so test it only against an approved disposable PostgreSQL database with a reviewed bootstrap procedure. Health response alone is insufficient; inspect startup logs and schema-dependent endpoint success. |
| V5 | Backend automated tests | Invoke only `backend/tests` after global-engine/lifespan isolation gate. Add pytest/pytest-asyncio to a small reviewed development manifest, disable unrelated plugin autoload and explicitly load required plugin. Dummy Stripe/SMTP/Resend/Cloudflare values; fail all unexpected network calls; no production/development connection strings. Never run broad repository pytest discovery. |
| V6 | Allowlisted API/route smoke tests | Local disposable environment only. `/health` and public list/detail endpoints plus known authenticated fixtures. Do not enumerate/crawl all GET endpoints: group debug route can mutate; view/click endpoints may record analytics. Confirm permissions for normal/admin/organizer users. |
| V7 | Product-critical behaviour | Home; event list/detail and slug/UUID query-preserving permanent redirects; login/logout; submission wizard; admin moderation/venues; venue shared modal; organizer ticketing and terms acceptance; mocked Stripe checkout/webhook/refund/idempotency/scanner; mobile/desktop map default seven-day filter/pins; location base/today/weekend; collections bounds/analytics and SSR OG/JSON-LD; 404/500/sitemap/robots. Use local fixture data. |

Apply V0 to every batch. Batch 1 cache/doc-only work does not justify connecting to a database or running payment flows. Batches 4/5 require V2–V3 plus relevant V6–V7 and baseline V5. Backend script/config changes require V4–V5 after isolation, not executing maintenance tools against real data. Migration startup validation is a distinct prerequisite task on disposable PostgreSQL; this plan does not supply a risky shortcut to bootstrap it. No large new suite is requested: first isolate the existing tests, restore/replace a small critical browser smoke set and add focused missing safety assertions.

## G. Manual confirmations

### CONFIRMED

* Render build command: `pip install -r requirements.txt` (Craig).
* Current deployed commit: `69d1966`, “Fix 404 on seller stripe connect onboarding for non-admin users” (Craig); matches the full audited local HEAD.
* Current project branch: `dev` (Craig and read-only local Git verification). The Render service's configured branch/auto-deploy policy has not been independently inspected.

### MUST CONFIRM BEFORE CLEANUP (for the affected batch)

1. **Render/deployment:** exact service root, start/predeploy/release commands, runtime versions and instance/worker count; frontend hosting/build process; confirm whether commands mention `expire_featured`, `deploy_fix`, `fix_admin_user` or any archived script. Verify Render is configured to deploy `dev` before changing deployment settings. Build command and current deployed commit are already confirmed above and need not be supplied again. Required before deployment/config/script changes, not before a documentation-only review.
2. **Jobs and manual tools:** list cron/scheduled/background/external automation commands and operator-used repair tools; whether featured expiry currently runs and last success. Confirm which source/paths are authoritative for image/venue/NC500/duplicate maintenance.
3. **Database state and recovery:** obtain authorised read-only `alembic_version`, SQL ledger, baseline history/source-less revision history, and available backup/restore evidence. Required before migration-adjacent changes or claiming reproducible startup. No migration cleanup is part of these batches.
4. **Safe verification environment:** identify disposable DB/test accounts and confirm production/development secrets are excluded. Confirm `CRON_SECRET_KEY` is non-default and whether the unauthenticated debug routes are deployed; resolve security/isolation blockers in separate tasks before network/deployment verification.
5. **Public contracts and local evidence:** confirm asset URLs stored in DB/external sites and compatibility links/bookmarks before Batch 5 asset/URL decisions; confirm local processes are stopped and reports/mappings/private archives are preserved before generated/evidence cleanup. Confirm no unpublished/external source consumers before Batch 4.

### CAN CONFIRM LATER

* Preferred retention owner/period for historical plans/logs and private credential-bearing archives; whether the old browser/refund test source exists in a developer backup or remote-only branch.
* External scraper integration documentation: which typed ingestion/admin import endpoint, auth contract and payload version the separate manually run project uses. No scraper source search, restoration, ignore change or scheduling work is needed for main-repository cleanup.

No reply is needed to finish this report. Approval later must name a specific batch/subbatch and satisfy only its relevant gates; blanket “cleanup” approval should not silently include migrations, payment/data repair, deployment or public URL removal.

## H. Documentation organisation

Keep root onboarding and authoritative agent/context entrypoints in place. Add a curated docs index with architecture/operations/development/audits/historical destinations; avoid renaming every root document. Historical plans remain evidence and receive an explicit historical banner only in their new approved copies/locations, never retroactively treated as current requirements. Documentation moves need link updates and a secret/identity/path screen before tracking previously ignored content.

| Document(s) | Classification | Proposed action/destination | Reason |
|---|---|---|---|
| events_hub_context.md; AGENT_RULES.md; .agents/AGENTS.md | Current authoritative documentation | KEEP exact locations; no editorial rewrite in cleanup | Master architecture/inviolable rules and agent entrypoints. |
| README.md | Current onboarding entrypoint; stale contents | KEEP; MODIFY setup and links in Batch 0/2 | Remove stale Mapbox/gamification, absent seed script and nonexistent npm test instructions; describe current stack and verified commands only. |
| SYSTEM_MAP.md | Useful architecture/operations map, partly stale | KEEP root; MODIFY obsolete form references in Batch 2 | Current consumers use wizard, not EventTicketingSection. External scraper references document integration only. Link docs/architecture/index.md. |
| REPOSITORY_INVENTORY.md; REPOSITORY_CLEANUP_PLAN.md | Current audit evidence/proposal | KEEP root for this audit; link from docs/audits/index.md | Preserve original report; this plan carries corrections. Optional eventual relocation requires its own link-update decision. |
| TICKETING_ENGINE_AUDIT_REPORT.md | Useful prior audit; not current test result | MOVE → docs/audits/TICKETING_ENGINE_AUDIT_REPORT.md | Preserve dated ticketing evidence and verify relative links. |
| homepage_rebuild_plan.md | Historical implementation plan | ARCHIVE → docs/historical/homepage_rebuild_plan.md | Some behaviour now implemented; retain rationale without using as current spec. |
| backend/README.md | Duplicate placeholder document | KEEP; MODIFY to backend-specific setup/operations pointer | 48 bytes, byte-identical to frontend README, but location is a useful onboarding contract. |
| frontend/README.md | Duplicate placeholder document | KEEP; MODIFY to frontend-specific setup/check commands | Do not delete merely for duplicate placeholder bytes. |
| _archive/misc/BACKEND_AUDIT_REPORT.md | Historical audit | MOVE → docs/audits/historical/BACKEND_AUDIT_REPORT.md after screening | Long prior audit, useful provenance; not a current finding guarantee. |
| ../AUDIT_PLAN.md; ../AUDIT_REPORT.md; ../specifications.md; ../homepage_rebuild/ | Containing-workspace plans/audits/design history | KEEP outside repository; reference in docs/historical/index.md if useful | Not repository files or production dependencies. Ownership/scope and secret review required before any future import. |
| archive/install_log.txt; archive/out.txt; archive/out_utf8.txt | Historical tool output, not maintained documentation | KEEP in current archive pending investigation | Do not move raw logs into tracked docs or delete them merely as old text. |
| frontend/playwright-report/**; frontend/test-results/** | Generated diagnostic documents | KEEP temporarily at current paths (B) | Not architecture documentation; preserve missing-test evidence. |

### Exact historical-document move register

All 29 files below are historical/superseded implementation or status records, not delete candidates. Proposed action is ARCHIVE, conditional on screening and explicit Batch 2 approval. Preserve basename/extension and nested plans directory, including the extensionless phase2.40. Destination paths are unique. This imports some currently ignored material into a curated tracked historical area; do not stage raw secrets or credentials.

| Source | Proposed destination | Classification |
|---|---|---|
| _archive/docs/CURRENT_STATUS.md | docs/historical/legacy/CURRENT_STATUS.md | Historical status/operational notes; superseded authority |
| _archive/docs/IMPLEMENTATION_PLAN.md | docs/historical/legacy/IMPLEMENTATION_PLAN.md | Historical implementation plan |
| _archive/docs/password_sprint.md | docs/historical/legacy/password_sprint.md | Historical status/operational notes; superseded authority |
| _archive/docs/phase2.10.md | docs/historical/legacy/phase2.10.md | Historical implementation plan |
| _archive/docs/phase2.11.md | docs/historical/legacy/phase2.11.md | Historical implementation plan |
| _archive/docs/phase2.2.md | docs/historical/legacy/phase2.2.md | Historical implementation plan |
| _archive/docs/phase2.3.md | docs/historical/legacy/phase2.3.md | Historical implementation plan |
| _archive/docs/phase2.40 | docs/historical/legacy/phase2.40 | Historical implementation plan |
| _archive/docs/phase2.41.md | docs/historical/legacy/phase2.41.md | Historical implementation plan |
| _archive/docs/phase2.42.md | docs/historical/legacy/phase2.42.md | Historical implementation plan |
| _archive/docs/phase2.6.md | docs/historical/legacy/phase2.6.md | Historical implementation plan |
| _archive/docs/phase2.71.md | docs/historical/legacy/phase2.71.md | Historical implementation plan |
| _archive/docs/phase2.72.md | docs/historical/legacy/phase2.72.md | Historical implementation plan |
| _archive/docs/phase2.75.md | docs/historical/legacy/phase2.75.md | Historical implementation plan |
| _archive/docs/phase2.8.md | docs/historical/legacy/phase2.8.md | Historical implementation plan |
| _archive/docs/phase2.md | docs/historical/legacy/phase2.md | Historical implementation plan |
| _archive/docs/phase3.0.md | docs/historical/legacy/phase3.0.md | Historical implementation plan |
| _archive/docs/phase3.1.md | docs/historical/legacy/phase3.1.md | Historical implementation plan |
| _archive/docs/PROJECT_STATUS_MASTER.md | docs/historical/legacy/PROJECT_STATUS_MASTER.md | Historical status/operational notes; superseded authority |
| _archive/docs/plans/2025-12-09-phase2a-categories-tags-media-design.md | docs/historical/legacy/plans/2025-12-09-phase2a-categories-tags-media-design.md | Historical implementation plan |
| _archive/docs/plans/2025-12-09-phase2a-implementation-plan.md | docs/historical/legacy/plans/2025-12-09-phase2a-implementation-plan.md | Historical implementation plan |
| _archive/docs/plans/2025-12-10-admin-section-implementation-plan.md | docs/historical/legacy/plans/2025-12-10-admin-section-implementation-plan.md | Historical implementation plan |
| _archive/docs/plans/2025-12-11-phase-2.10-implementation.md | docs/historical/legacy/plans/2025-12-11-phase-2.10-implementation.md | Historical implementation plan |
| _archive/docs/plans/2025-12-12-phase-2.10-remaining-work.md | docs/historical/legacy/plans/2025-12-12-phase-2.10-remaining-work.md | Historical implementation plan |
| _archive/docs/plans/2025-12-28-email-engine-design.md | docs/historical/legacy/plans/2025-12-28-email-engine-design.md | Historical implementation plan |
| _archive/docs/plans/2025-12-28-email-engine-implementation.md | docs/historical/legacy/plans/2025-12-28-email-engine-implementation.md | Historical implementation plan |
| _archive/docs/plans/2025-12-28-highland-ads-design.md | docs/historical/legacy/plans/2025-12-28-highland-ads-design.md | Historical implementation plan |
| _archive/docs/plans/2025-12-28-highland-ads-implementation.md | docs/historical/legacy/plans/2025-12-28-highland-ads-implementation.md | Historical implementation plan |
| _archive/docs/plans/2025-12-29-google-maps-migration-design.md | docs/historical/legacy/plans/2025-12-29-google-maps-migration-design.md | Historical implementation plan |

Safe eventual deletion candidates among documents are limited to replaceable generated report copies after missing-test investigation (no DELETE authorised now). Backend/frontend placeholder READMEs should be improved, not deleted. The old plans need archival labels and an index, not loss of history. New index/setup documents are proposed Batch 0/2 additions, not created during this phase.

## I. Proposed final structure — minimal churn

```text
highland_events_app/
  README.md
  events_hub_context.md             # authoritative; stays here
  AGENT_RULES.md
  .agents/AGENTS.md
  SYSTEM_MAP.md                     # curated root navigation/architecture map
  REPOSITORY_INVENTORY.md            # current audit deliverables retained here
  REPOSITORY_CLEANUP_PLAN.md
  .gitignore
  docker-compose.yml                # explicit development/deployment role
  pytest.ini                        # proposed scoped discovery, after isolation review
  frontend/
    package.json, package-lock.json, tsconfig.json
    src/pages/, src/components/, src/lib/, ...
    public/                         # protected public asset URLs + PWA metadata
    tests/                          # small approved browser suite when restored/replaced
    playwright.config.ts
    node_modules/, .next/            # local ignored; never checked in
  backend/
    app/                            # APIs, services, models, schemas, core
      scripts/                      # operational/backfill module paths unchanged
    alembic/versions/               # KEEP full history
    migrations/                     # KEEP SQL ledger migrations
    scripts/                        # current runner and manual tools stay stable
      archive/                      # existing historical scripts
        debug/                      # proposed disabled scratch reproduction
    tests/                          # isolated pytest suite
    requirements.txt
    requirements-dev.txt            # proposed narrow test dependency manifest
    start.sh, release.sh
    static/uploads/                 # storage contract retained
    .env.example                    # sanitised tracked template
    .env, .venv/                    # private/local ignored
  scripts-node/                     # stable manual venue-repair paths
    package.json, package-lock.json # proposed tracked manifests
  docs/
    index.md
    architecture/index.md           # links to root authoritative context/system map
    operations/index.md             # deployment/job/tool ownership and safe procedures
    development/setup.md            # verified runtimes, env names, install/check commands
    audits/index.md
    audits/TICKETING_ENGINE_AUDIT_REPORT.md
    audits/historical/BACKEND_AUDIT_REPORT.md
    historical/index.md
    historical/homepage_rebuild_plan.md
    historical/legacy/              # exact legacy-document destinations in H
  archive/                          # existing local historical scripts retained initially
  _archive/
    scripts/, logs/, migration_artefacts/, misc/, sqlite_dbs/
                                    # preserve recovery/operational evidence
```

Operational and maintenance scripts stay distinguished by the operations register and their invocation contract rather than a disruptive folder migration. Existing archive roots are retained until external dependencies and private retention are settled. Database migrations remain separate and unchanged. Empty scratch/tmp removal is optional local tidiness. No `scrapers/` tree is introduced.

## J. Execution plan — approve one small batch at a time

**No batch below has been implemented.** Each approval must name the batch/subbatch and exact scope. A failed verification stops that batch; do not compensate by changing unrelated code. Commit approved tracked changes independently; preserve preexisting user changes. For ignored/untracked files take a private byte-preserving backup outside the deletion targets first. Record file hashes and original paths. Reverting a code commit does not undo database writes or restore an ignored archive, which is why no database-mutating cleanup is proposed.

### Batch 0 — Repository safety and reproducibility

**Objective:** establish what is tracked, protect private files, and obtain safe build/test/deployment baselines. Split into 0A–0D; approve each independently. Risk: **low for 0A, medium/high for runtime/testing prerequisites**. Cosmetic cleanup can proceed only through its own relevant gates; code/deployment cleanup waits for working baselines.

| Subbatch / exact files | Action and exact modification | Reason / prerequisite | Verification / rollback |
|---|---|---|---|
| 0A `.gitignore` | MODIFY only the documentation rule and append the exact allowlist/cache rules in A. KEEP all scraper/real-env/data exclusions. | Correct misleading broad ignores without admitting arbitrary JSON/secrets. Screen targeted manifests/template first. | V0; compare `git ls-files` versus `check-ignore --no-index`; test each allowlisted path and representative real .env/dump/archive paths. Revert only this commit if needed. |
| 0A `frontend/package.json`, `frontend/package-lock.json`, `frontend/tsconfig.json` | KEEP byte-identical and tracked. | They are already present in Git; no restore/recreation needed. | V0 content hashes; no functional change to roll back. |
| 0A `scripts-node/package.json`, `scripts-node/package-lock.json` | KEEP existing bytes; explicitly add screened files to Git together. Do not run npm start. | Makes retained manual tools reproducible; runner issue remains documented. | V0 manifest/lock root equality and staged secret/path review. Revert tracking commit; preserve private local copies. |
| 0A `backend/.env.example` | MODIFY template only if necessary to replace real/nonportable values and align setting names with config, then track; retain placeholder credentials. No root .env.example creation. | Current inspected values appear safe; SMTP names/new settings need reconciliation. Never copy real .env values. | V0 compare names to config, staged secret/path review, check real env files remain ignored. Revert template commit, preserve original template backup. |
| 0A `README.md`; new `docs/development/setup.md` | MODIFY README stale setup/test claims and links; MODIFY (new document) setup with verified runtime/command/env-name contract and explicit external scraper boundary. | Fresh-clone users need accurate commands. Mark blocked startup/bootstrap clearly until resolved; do not claim tests pass. | V0 and link/path checks. Revert documentation-only commit. |
| 0B `frontend/Dockerfile`; new `frontend/.dockerignore`, `backend/.dockerignore`; `docs/development/setup.md` | MODIFY frontend runtime to exact approved Node version satisfying current lock; choose/build production image only if actual deployment uses it. Add context exclusions described in A. Record runtime and tested image role. | **Gate:** confirm Render Docker/native build process and public/SSR env requirements. Development compose intent must remain explicit; no silent production switch. | V0–V3 in disposable checkout; inspect image/context for private env/caches without printing secrets. Revert Docker/config commit; retain previously validated image. |
| 0B `backend/requirements.txt`; new `backend/requirements-dev.txt`; `docs/development/setup.md` | KEEP production dependency behaviour initially. Add only reviewed pytest/pytest-asyncio versions to development manifest. Pin/lock backend dependencies only in a separate reviewed resolution commit after Python 3.11/deployed-version baseline. | Do not freeze unrelated global packages or upgrade services incidentally. Exact versions depend on clean installation evidence; this is a gate, not an invented pin. | V1 plus isolated V4–V5; lock review. Revert manifest commit, recreate isolated env from previous recorded dependency set. |
| 0C new `pytest.ini`; `backend/tests/conftest.py`; `backend/tests/test_scanner.py`; `backend/tests/test_organizer_invoices.py`; `backend/tests/test_cancellation_and_reschedule.py` | MODIFY (new config) scoped `testpaths = backend/tests` and exclusions for archive/_archive/scratch/generated/dependency trees. MODIFY fixtures only to establish dummy settings before imports and isolate direct global engine/lifespan/migration calls; remove unintended startup from handler-only fixtures or supply a separate disposable startup fixture. No business/payment assertions removed. | **Separate prerequisite safety fix**, approved before running tests. Adding discovery config alone does not solve lifespan leakage. Do not modify app runtime to evade tests. | Static inspect fixture/import order, fail if any non-test DB/network target used, then V5 in disposable environment. Roll back test-only commit; delete no database content. |
| 0C `frontend/package.json`; `frontend/playwright.config.ts`; new `frontend/tests/smoke.spec.ts`; paired `frontend/package-lock.json` only if dependency metadata changes | MODIFY to expose `typecheck` (`tsc --noEmit --incremental false`) and test (`playwright test`) commands; define safe local baseURL/server contract; restore from verified history OR add a small approved smoke test, not an invented replacement labelled recovered. Preserve existing dev/build/start scripts. Keep lint unconfigured until separately approved. | Required before frontend deletion. Missing historical source and HTTP 429 parallel auth need isolated test accounts/rate-limit-aware test design. No broad new suite. | V2–V3, targeted local browser checks V7; confirm no public/prod endpoints or payment secrets. Revert test/config commit; retain original reports. |
| 0D `backend/app/api/groups.py`; `backend/app/api/cron.py`; focused regression tests in `backend/tests/test_operational_safeguards.py` (or separately named approved security test file) | KEEP unchanged in cleanup; open **separate security remediation task** to remove/protect debug schema mutation/tracebacks and eliminate default-secret acceptance. | Production security priority; not cosmetic dead-code deletion. Confirm deployed routes/settings without invoking mutation endpoints. | Separate task must prove unauthenticated denial/no schema side effect and operational cron compatibility. No changes/rollback in this cleanup plan. |
| 0D `backend/start.sh`, `backend/release.sh`, `backend/alembic/**`, `backend/migrations/**`, `backend/app/core/inline_migrations.py`, `backend/app/core/database.py`, `backend/app/main.py`, migration helpers in D | KEEP. Separate migration-bootstrap/deployment audit before altering commands or claiming empty-DB reproducibility. | **Gate:** G production-state/backup confirmation and authorised disposable PostgreSQL exercise. No stamp/rewrite/replay work in cleanup. | Record source graph, deployed state and logs; no migration execution here and no cleanup rollback involving database. |

Batch 0 is complete only for substeps whose criteria are met. Record unresolved runtime/fixture/bootstrap issues and block dependent batches. Do not use the number “0” to imply approval for all prerequisite engineering work at once.

### Batch 1 — Safe generated clutter

**Objective:** remove reproducible local state without losing missing-source evidence. **Risk: low** after exact-path checks. **Prerequisites:** approval for 1A/1B, relevant processes stopped, source-backed manifest revalidated, preserved historical logs and 29 source-less caches. No external production inspection required for a stopped disposable local cache-only 1A.

| Subbatch / exact targets | Action | Deletion evidence and constraints |
|---|---|---|
| 1A Exact 179 source-backed bytecode paths in Appendix 1 | DELETE listed files only | Each has a corresponding `.py` source. Python regenerates bytecode; ignored. Do not delete source-less neighbours or parent __pycache__ wholesale. If a source disappears or hash/count changes, regenerate review manifest before approval. |
| 1A `.pytest_cache/`, `backend/.pytest_cache/` | DELETE cache metadata/directories only | Pytest-generated node/failure state, not tests; already ignored. Retain any investigation-needed node list privately first. Check roots contain only known cache metadata at execution time. |
| 1A `backend/tmp/`, `frontend/scratch/` | DELETE only if still empty | Empty at inspection, no tracked contents/callers; no production behaviour. If contents appear, stop and reclassify. |
| 1B `frontend/tsconfig.tsbuildinfo`; `.gitignore` only if not already addressed by 0A | DELETE tracked cache; MODIFY ignore by adding exact /frontend/*.tsbuildinfo rule only | Regenerated incremental state, no source; baseline type diagnostics retained separately first. Keep compiler settings unchanged. |
| All remaining B items | KEEP / RETAIN as classified | No `.next`, report, mapping, PWA or source-less cache purge in this batch. No dependency reinstall/removal. |

**Verification:** V0, compare all production/source hashes, ensure the 29 retained pycs still exist and empty-directory targets had no contents. For 1B run V2 only after its isolation/tooling prerequisites; no DB/startup/payment checks needed for pure caches. **Rollback:** restore saved ignored cache bytes/empty directories if investigation needs exact prior state; source-backed bytecode can regenerate. Restore tracked tsbuildinfo by reverting its dedicated commit. Do not run an unreviewed app just to regenerate bytecode.

### Batch 2 — Documentation and historical information

**Objective:** make current guidance discoverable while preserving history. **Risk: low functional, medium information exposure** for previously ignored docs. **Prerequisites:** 0A docs eligibility, individual secret/identity/path review and a private original backup. Keep unscreened files in place until reviewed.

| Exact targets | Action | Reason / condition |
|---|---|---|
| `events_hub_context.md`, `AGENT_RULES.md`, `.agents/AGENTS.md`; current audit reports at root | KEEP | Authoritative entrypoints/audit history stay stable. No automatic context rewrite. |
| `README.md`, `SYSTEM_MAP.md`, `backend/README.md`, `frontend/README.md` | MODIFY setup/navigation only; replace placeholder subproject text, correct stale form route references and link new docs | Do not change architectural rules or invent supported commands. Preserve root entry paths. |
| New `docs/index.md`, `docs/architecture/index.md`, `docs/operations/index.md`, `docs/audits/index.md`, `docs/historical/index.md` | MODIFY (new documents): curate links, current versus historical labels, script classification/invocation ownership and external confirmation status | No secrets or raw production identifiers. Operations index records script safety without executing anything. |
| `TICKETING_ENGINE_AUDIT_REPORT.md` | MOVE → `docs/audits/TICKETING_ENGINE_AUDIT_REPORT.md` | Prior audit belongs with audits; update referring links and retain dated content. |
| `homepage_rebuild_plan.md` | ARCHIVE → `docs/historical/homepage_rebuild_plan.md` | Historical plan with useful design rationale. |
| `_archive/misc/BACKEND_AUDIT_REPORT.md` | MOVE → `docs/audits/historical/BACKEND_AUDIT_REPORT.md` | Preserve original audit, screen before newly tracking. |
| The exact 29 `_archive/docs/` files in H | ARCHIVE to each exact `docs/historical/legacy/...` destination in H | Historical/superseded status is not deletion evidence. Preserve original basename and directory relationships. Files failing content review remain KEEP at original path pending private retention decision. |
| `archive/` text/logs, all B investigation artefacts, containing-workspace documents | KEEP current paths | No raw log import, scraper documentation expansion or containing-workspace restructuring. |

**Verification:** V0 plus source/destination byte hashes, no overwrite/collision, relative links/headings/dated historical labels and staged content screen. Check every proposed moved source has exactly one destination; update links only after recording the original content. No application tests or database access needed. **Rollback:** revert tracked doc commit and restore original ignored documents from private backup; if Git never tracked the originals, revert alone is insufficient. No document DELETE proposed.

### Batch 3 — Dangerous/debug/manual-script organisation

**Objective:** stop accidental discovery/execution and document operator ownership without breaking operational paths. **Risk: medium; high if mistaken for authorisation to run repairs.** **Prerequisites:** G job/manual-tool confirmation, 0C test isolation, private archival backup and explicit approval of the one scratch move.

| Exact targets | Action | Reason / prerequisite |
|---|---|---|
| `backend/scratch/test_event_update_moderation.py` | ARCHIVE → `backend/scripts/archive/debug/test_event_update_moderation.py.disabled` | Preserve dangerous reproduction while removing pytest/module discovery. No content refactor. Destination intentionally non-executable by ordinary Python test discovery. Confirm no operator/scheduler depends on source path. |
| `.gitignore` | MODIFY only if needed to keep the **single disabled destination** intentionally tracked: append `!/backend/scripts/archive/`, `/backend/scripts/archive/*`, `!/backend/scripts/archive/debug/`, `/backend/scripts/archive/debug/*`, `!/backend/scripts/archive/debug/test_event_update_moderation.py.disabled` | Parent is ignored today. These rules expose only the screened disabled file, not other archived scripts. Recheck directory-traversal/ignore results before staging. Alternative is private archival retention with recorded provenance; choose explicitly before move, not by silently losing a tracked source. |
| `pytest.ini`, `backend/tests/conftest.py` and the three affected TestClient modules listed in 0C | KEEP reviewed safety changes from 0C; do not broaden discovery | Do not rely on the scratch move to make archive/test_api.py or fixture startup safe. |
| Every other script in D, including `expire_featured.py`, `_archive/scripts/deploy_fix.py`, image/NC500/admin/duplicate/Node tools and old migration runners | KEEP exact current paths; no execution | External consumers unknown or operational/recovery value persists. No mass relocation to new scripts folders. |
| `docs/operations/index.md` | MODIFY ownership/schedule/current-working-directory/input-file/safety notes using confirmed facts | Explicitly mark image mapping location, Node runner/env-path issue, NC500 preview mismatch and duplicate/payment risk. Keep unconfirmed commands labelled unconfirmed. |

**Verification:** V0; source/destination hash equal for scratch; exact disabled archive path remains in tracked manifest if chosen; no new Python-test discovery outside backend/tests; no production import/call references broken. Perform static parsing only on maintenance source; do not execute any script, including dry runs, to verify a move. V5 only with isolation prerequisites. **Rollback:** move disabled file back byte-for-byte from preserved backup or revert tracked move/config commit, restore ignore rules and operation links. Restore nothing by running data repair scripts.

### Batch 4 — Confirmed dead frontend dependency groups

**Objective:** remove only route-unreachable groups after proving required live behaviour. **Risk: low–medium per group, medium–high for forms/maps.** **Prerequisites:** 0A/0C, safe V2/V3/V5 baseline, owner confirms no unpublished/external source consumers, current graph/literal/config scan matches C. Each group is its own approval/commit; do not delete whole component directories.

| Subbatch / exact files | Proposed action | Evidence / special gate |
|---|---|---|
| 4A G1: `frontend/src/components/admin/EventForm.tsx` | DELETE | No inbound static/dynamic/reexport/config reference. Active edit flows use other components. Verify admin create/edit and shared controls. |
| 4B G2: the six exact paths in C/G2 | DELETE all six as one dependency group | Four old roots lead only to FormSection/MapPinAdjuster. Keep active EventScheduleSection in same directory; review SYSTEM_MAP stale literal first. |
| 4C G3: the four exact paths in C/G3; `frontend/src/components/events/index.ts` | **KEEP blocked by default.** On separate compatibility-export approval: MODIFY barrel to remove only `export { EventFilters } from './EventFilters';`, then DELETE those four files | Master context explicitly replaced EventFilters; AST proves only barrel incoming. Shared date picker goes only with both old consumers. Removing an exported symbol is a compatibility decision even without local page consumers. Other barrel exports and wrappers stay. |
| 4D G4: `frontend/src/components/events/ClusterMarker.tsx`, `frontend/src/utils/groupEventsByLocation.ts` | DELETE pair | Only inbound edge is a type import from unused ClusterMarker. Keep current clustered markers and shared models. |
| 4E G5: five exact paths in C/G5 | DELETE as individually approved map substeps | No inbound edge; active map is a different chain. Verify map-specific requirements after each relevant substep. |
| 4F G6: `frontend/src/components/locations/SpotlightCard.tsx`, `frontend/src/lib/stringUtils.ts` | DELETE pair | Helper's only importer is orphan card. Keep DOMPurify/current sanitisation and OptimizedImage. |
| 4G G7: six exact paths in C/G7 | DELETE independent roots, preferably one per commit | No inbound code; VenueCard has only historical scaffold literal. Active card/feed/promotion/tag services remain. |
| 4H G8/G9/G11/G13: exact one social renderer, two hooks, two constants, skeleton+common-barrel paths in C | DELETE one group per commit | No active importer/config resolver. G13 removes barrel and its sole export together. Keep active loading/URL/location behaviour. |
| G10 image helpers, G12 ErrorBoundary, G14 compatibility files; every current page/asset/API/shared active dependency | KEEP for Batch 5 decision or permanently as specified | Do not extend deletion to active npm packages, styles, provider services, routes, brand assets or shared venue editor. |

**Verification for every group:** V0; fresh graph confirms no unresolved imports/reexports; V2 and V3; V6/V7 subset specified in C. Keep baseline V5 passing in isolated environment. Forms require wizard/admin/price/terms tests; maps require date/coordinate/cluster/mobile checks; cards require SSR/SEO/image/text smoke. No change to ticketing/payment logic, CSS/nav/brand, migration/model source or public URL semantics. A source removal that needs live-code refactoring beyond 4C's explicitly approved export edit is blocked for separate review. **Rollback:** revert only the group's commit, restore exact files and export if changed, rerun relevant checks; no database rollback because none was touched.

### Batch 5 — Remaining low-risk candidates and compatibility decisions

**Objective:** handle small proven duplicates and leftovers; preserve URL/asset contracts. **Risk: low for exact duplicate source/helper deletion; uncertain for externally visible contracts.** **Prerequisites:** all relevant G confirmations and successful applicable Batch 4 baseline.

| Exact targets | Proposed action | Evidence / condition |
|---|---|---|
| `frontend/src/lib/cloudinary.ts`, `frontend/src/lib/images.ts` (G10) | DELETE pair only on separate approval | Zero active consumers and active `utils/imageOptimizer.ts` handles current formats. Shared provider/backend service remains. Verify Cloudinary URL and Cloudflare ID rendering plus OG fallback. No deletion of hosted images/credentials/packages. |
| `archive/check_data_v2.py` | DELETE only after operator confirms no path-based use and private backup exists | Exactly identical to retained `archive/check_data.py`: 824 bytes, SHA-256 `f47002c60638fada1aca58f5c773a26b45b0ba61591a1a4cccff2a32829a44e3`. No exact repository caller. Duplicate bytes establish redundancy, not absence of external invocation. |
| `frontend/src/components/ui/ErrorBoundary.tsx` (G12) | KEEP pending explanation of inline map boundary/build history | No current import, but purpose/history unresolved; no deletion recommendation now. |
| Five G14 compatibility barrels/wrappers | KEEP, except the separately approved single EventFilters export adjustment in 4C | Low maintenance cost; may preserve old source import contracts. Do not delete alias to required EditVenueModal. |
| `frontend/public/logo_knot.jpg`, `frontend/public/icons/logo_knot.jpg` | KEEP both | Byte-identical but different public URLs can be referenced externally/PWA/DB. No evidence sufficient to delete either. |
| All other `frontend/public/**` assets; compatibility Pages Router URLs; backend provider/services/config/template files not explicitly changed above | KEEP | Missing local imports do not prove unused public URLs or database-stored asset paths. Explicit user design/URL authorisation plus external evidence required for a separate change. |
| Remaining source-less bytecode, Playwright/build/test logs, image mappings, historical repair scripts | KEEP/RETAIN until investigations close | No automatic “final cleanup” sweep. Later deletion requires a new exact manifest, retained recovery evidence and approval. |

**Verification:** V0–V3 and image/SEO cases of V7 for G10. For duplicate check_data_v2 deletion, compare retained file hash and search exact script references; no DB invocation needed. Public compatibility/assets are unchanged and should hash-match. **Rollback:** revert tracked helper deletion; restore ignored duplicate from private backup. No cloud/database action and no blanket rollback of user changes.

## Completion criteria and handoff

The result of this phase is this plan, not a cleaned repository. The next actionable selection is **Batch 0A** or, after local evidence preservation, **Batch 1A**; both still require explicit batch approval. Security, test isolation and migration bootstrap work are visible prerequisites with separate scope. A batch is done only when its exact diff, verification evidence and rollback material exist; skipped/blocked items remain KEEP, not implicitly authorised for later removal.

All application files, configuration, migrations, scripts, public assets and the earlier inventory were retained unchanged while preparing the plan. Only this report was added inside the repository; audit helpers/evidence were created under the containing workspace's `../tmp/`. No external service/deployment state was inspected, no scraper work occurred and no cleanup was performed.

Final non-mutating verification compared **578 protected files** (577 significant inventory files plus the original inventory report) with recorded SHA-256 baselines: **zero changed or deleted**. Git showed no tracked modifications and only the two audit reports as untracked additions, with the inventory report already present before this phase. The new report was checked for coverage of all 41 unreachable modules, all 56 scripts, all 29 historical document destinations and balanced Markdown code fences.

## Appendix 1 — Exact source-backed bytecode deletion candidates for Batch 1A

179 files at inspection. This is an approval manifest, not a shell glob to execute. Each file has a matching source at its parent directory. Revalidate source existence/hashes and stop local processes before any later deletion. All 29 source-less files in B are excluded. Retain private cache evidence first if the investigator needs byte-exact historical interpreter output.

- `backend/alembic/__pycache__/env.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/257747883830_add_facebook_url_and_instagram_url_to_.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/2b4255d70229_baseline_setup.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/6daaeeecd963_add_contact_number_to_organizers.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/869936c87afe_add_composite_index_for_status_and_date_.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/8a699a46d724_add_about_history_to_venues.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/9c316f37862e_add_native_ticketing_schema_and_tier_.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/a1b2c3d4e5f6_add_pass_fees_to_buyer_and_platform_settings.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/b2c3d4e5f6a7_add_event_cancellation_and_reschedule_fields.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/c3d4e5f6a7b8_add_enable_venue_filter_to_collections.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/c6a141c8f560_add_partner_fields_to_location.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/d4e5f6a7b8c9_add_organizer_profile_ids_to_collections.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/e40d1624dc85_add_collection_hero_custom_fields.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/e5f6a7b8c901_add_view_count_and_link_click_count_to_collections.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/e9b6ba72632d_add_seller_tier_to_users.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/ecae8676089f_add_recurrence_end_date_to_event.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/f506de5cf913_add_pending_events_table.cpython-314.pyc`
- `backend/alembic/versions/__pycache__/f6a7b8c90123_add_bounding_box_to_collections.cpython-314.pyc`
- `backend/app/__pycache__/main.cpython-314.pyc`
- `backend/app/api/__pycache__/__init__.cpython-314.pyc`
- `backend/app/api/__pycache__/accommodation_ads.cpython-314.pyc`
- `backend/app/api/__pycache__/admin.cpython-314.pyc`
- `backend/app/api/__pycache__/admin_import.cpython-314.pyc`
- `backend/app/api/__pycache__/admin_sellers.cpython-314.pyc`
- `backend/app/api/__pycache__/admin_ticketing.cpython-314.pyc`
- `backend/app/api/__pycache__/analytics.cpython-314.pyc`
- `backend/app/api/__pycache__/auth.cpython-314.pyc`
- `backend/app/api/__pycache__/bookmarks.cpython-314.pyc`
- `backend/app/api/__pycache__/buyer_ticketing.cpython-314.pyc`
- `backend/app/api/__pycache__/campaigns.cpython-314.pyc`
- `backend/app/api/__pycache__/categories.cpython-314.pyc`
- `backend/app/api/__pycache__/checkout.cpython-314.pyc`
- `backend/app/api/__pycache__/collections.cpython-314.pyc`
- `backend/app/api/__pycache__/cron.cpython-314.pyc`
- `backend/app/api/__pycache__/events.cpython-314.pyc`
- `backend/app/api/__pycache__/featured.cpython-314.pyc`
- `backend/app/api/__pycache__/geocode.cpython-314.pyc`
- `backend/app/api/__pycache__/groups.cpython-314.pyc`
- `backend/app/api/__pycache__/ingest.cpython-314.pyc`
- `backend/app/api/__pycache__/locations.cpython-314.pyc`
- `backend/app/api/__pycache__/map.cpython-314.pyc`
- `backend/app/api/__pycache__/media.cpython-314.pyc`
- `backend/app/api/__pycache__/moderation.cpython-314.pyc`
- `backend/app/api/__pycache__/notifications.cpython-314.pyc`
- `backend/app/api/__pycache__/organizer_ticketing.cpython-314.pyc`
- `backend/app/api/__pycache__/organizers.cpython-314.pyc`
- `backend/app/api/__pycache__/preferences.cpython-314.pyc`
- `backend/app/api/__pycache__/promotions.cpython-314.pyc`
- `backend/app/api/__pycache__/public_ads.cpython-314.pyc`
- `backend/app/api/__pycache__/recommendations.cpython-314.pyc`
- `backend/app/api/__pycache__/scanner.cpython-314.pyc`
- `backend/app/api/__pycache__/search.cpython-314.pyc`
- `backend/app/api/__pycache__/sellers.cpython-314.pyc`
- `backend/app/api/__pycache__/social.cpython-314.pyc`
- `backend/app/api/__pycache__/tags.cpython-314.pyc`
- `backend/app/api/__pycache__/users.cpython-314.pyc`
- `backend/app/api/__pycache__/venues.cpython-314.pyc`
- `backend/app/api/__pycache__/webhooks.cpython-314.pyc`
- `backend/app/core/__pycache__/config.cpython-314.pyc`
- `backend/app/core/__pycache__/database.cpython-314.pyc`
- `backend/app/core/__pycache__/inline_migrations.cpython-314.pyc`
- `backend/app/core/__pycache__/limiter.cpython-314.pyc`
- `backend/app/core/__pycache__/permissions.cpython-314.pyc`
- `backend/app/core/__pycache__/query_utils.cpython-314.pyc`
- `backend/app/core/__pycache__/security.cpython-314.pyc`
- `backend/app/core/__pycache__/utils.cpython-314.pyc`
- `backend/app/models/__pycache__/__init__.cpython-314.pyc`
- `backend/app/models/__pycache__/accommodation_ad.cpython-314.pyc`
- `backend/app/models/__pycache__/analytics.cpython-314.pyc`
- `backend/app/models/__pycache__/bookmark.cpython-314.pyc`
- `backend/app/models/__pycache__/campaign_log.cpython-314.pyc`
- `backend/app/models/__pycache__/category.cpython-314.pyc`
- `backend/app/models/__pycache__/collection.cpython-314.pyc`
- `backend/app/models/__pycache__/event.cpython-314.pyc`
- `backend/app/models/__pycache__/event_attendee.cpython-314.pyc`
- `backend/app/models/__pycache__/event_claim.cpython-314.pyc`
- `backend/app/models/__pycache__/event_participating_venue.cpython-314.pyc`
- `backend/app/models/__pycache__/featured_booking.cpython-314.pyc`
- `backend/app/models/__pycache__/follow.cpython-314.pyc`
- `backend/app/models/__pycache__/group_invite.cpython-314.pyc`
- `backend/app/models/__pycache__/group_member.cpython-314.pyc`
- `backend/app/models/__pycache__/location.cpython-314.pyc`
- `backend/app/models/__pycache__/notification.cpython-314.pyc`
- `backend/app/models/__pycache__/order.cpython-314.pyc`
- `backend/app/models/__pycache__/organizer.cpython-314.pyc`
- `backend/app/models/__pycache__/organizer_stripe_account.cpython-314.pyc`
- `backend/app/models/__pycache__/password_reset.cpython-314.pyc`
- `backend/app/models/__pycache__/payment.cpython-314.pyc`
- `backend/app/models/__pycache__/pending_event.cpython-314.pyc`
- `backend/app/models/__pycache__/platform_settings.cpython-314.pyc`
- `backend/app/models/__pycache__/promo_code.cpython-314.pyc`
- `backend/app/models/__pycache__/promotion.cpython-314.pyc`
- `backend/app/models/__pycache__/report.cpython-314.pyc`
- `backend/app/models/__pycache__/showtime.cpython-314.pyc`
- `backend/app/models/__pycache__/slot_pricing.cpython-314.pyc`
- `backend/app/models/__pycache__/tag.cpython-314.pyc`
- `backend/app/models/__pycache__/ticket.cpython-314.pyc`
- `backend/app/models/__pycache__/ticket_tier.cpython-314.pyc`
- `backend/app/models/__pycache__/user.cpython-314.pyc`
- `backend/app/models/__pycache__/user_category_follow.cpython-314.pyc`
- `backend/app/models/__pycache__/user_preferences.cpython-314.pyc`
- `backend/app/models/__pycache__/venue.cpython-314.pyc`
- `backend/app/models/__pycache__/venue_category.cpython-314.pyc`
- `backend/app/models/__pycache__/venue_claim.cpython-314.pyc`
- `backend/app/models/__pycache__/venue_invite.cpython-314.pyc`
- `backend/app/models/__pycache__/venue_staff.cpython-314.pyc`
- `backend/app/schemas/__pycache__/__init__.cpython-314.pyc`
- `backend/app/schemas/__pycache__/category.cpython-314.pyc`
- `backend/app/schemas/__pycache__/collection.cpython-314.pyc`
- `backend/app/schemas/__pycache__/event.cpython-314.pyc`
- `backend/app/schemas/__pycache__/event_claim.cpython-314.pyc`
- `backend/app/schemas/__pycache__/group_member.cpython-314.pyc`
- `backend/app/schemas/__pycache__/organizer.cpython-314.pyc`
- `backend/app/schemas/__pycache__/payments.cpython-314.pyc`
- `backend/app/schemas/__pycache__/pending_event.cpython-314.pyc`
- `backend/app/schemas/__pycache__/promotions.cpython-314.pyc`
- `backend/app/schemas/__pycache__/tag.cpython-314.pyc`
- `backend/app/schemas/__pycache__/ticketing.cpython-314.pyc`
- `backend/app/schemas/__pycache__/user.cpython-314.pyc`
- `backend/app/schemas/__pycache__/venue.cpython-314.pyc`
- `backend/app/schemas/__pycache__/venue_claim.cpython-314.pyc`
- `backend/app/scripts/__pycache__/__init__.cpython-314.pyc`
- `backend/app/scripts/__pycache__/backfill_preferences.cpython-314.pyc`
- `backend/app/scripts/__pycache__/expire_featured.cpython-314.pyc`
- `backend/app/scripts/__pycache__/migrate_add_trusted_organizer.cpython-314.pyc`
- `backend/app/scripts/__pycache__/migrate_featured_subtitle.cpython-314.pyc`
- `backend/app/scripts/__pycache__/migrate_slot_pricing.cpython-314.pyc`
- `backend/app/services/__pycache__/campaign_service.cpython-314.pyc`
- `backend/app/services/__pycache__/cloudflare_service.cpython-314.pyc`
- `backend/app/services/__pycache__/cloudinary_service.cpython-314.pyc`
- `backend/app/services/__pycache__/duplicate_detection.cpython-314.pyc`
- `backend/app/services/__pycache__/email_service.cpython-314.pyc`
- `backend/app/services/__pycache__/event_service.cpython-314.pyc`
- `backend/app/services/__pycache__/featured.cpython-314.pyc`
- `backend/app/services/__pycache__/fee_service.cpython-314.pyc`
- `backend/app/services/__pycache__/geolocation.cpython-314.pyc`
- `backend/app/services/__pycache__/media.cpython-314.pyc`
- `backend/app/services/__pycache__/moderation.cpython-314.pyc`
- `backend/app/services/__pycache__/notifications.cpython-314.pyc`
- `backend/app/services/__pycache__/payments.cpython-314.pyc`
- `backend/app/services/__pycache__/postcode_service.cpython-314.pyc`
- `backend/app/services/__pycache__/promo_service.cpython-314.pyc`
- `backend/app/services/__pycache__/promotions.cpython-314.pyc`
- `backend/app/services/__pycache__/recurrence.cpython-314.pyc`
- `backend/app/services/__pycache__/resend_email.cpython-314.pyc`
- `backend/app/services/__pycache__/stripe_service.cpython-314.pyc`
- `backend/app/utils/__pycache__/__init__.cpython-314.pyc`
- `backend/app/utils/__pycache__/pii.cpython-314.pyc`
- `backend/app/utils/__pycache__/price_age_parser.cpython-314.pyc`
- `backend/app/utils/__pycache__/validators.cpython-314.pyc`
- `backend/scratch/__pycache__/test_event_update_moderation.cpython-314-pytest-9.0.2.pyc`
- `backend/scripts/__pycache__/apply_constraints.cpython-314.pyc`
- `backend/scripts/__pycache__/cleanup_incorrect_nc500.cpython-314.pyc`
- `backend/scripts/__pycache__/migrate_uncategorized_venues.cpython-314.pyc`
- `backend/scripts/__pycache__/run_migrations.cpython-314.pyc`
- `backend/scripts/__pycache__/tag_historical_nc500.cpython-314.pyc`
- `backend/tests/__pycache__/conftest.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_auto_seller_verification.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_cancellation_and_reschedule.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_cancellation_and_reschedule.cpython-314.pyc`
- `backend/tests/__pycache__/test_checkout.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_checkout.cpython-314.pyc`
- `backend/tests/__pycache__/test_collections.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_event_moderation_queue.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_event_moderation_queue.cpython-314.pyc`
- `backend/tests/__pycache__/test_event_ticket_tiers.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_fee_service.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_fee_settings_api.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_location_hubs.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_operational_safeguards.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_organizer_invoices.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_organizer_invoices.cpython-314.pyc`
- `backend/tests/__pycache__/test_private_beta_ticketing_gating.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_scanner.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_scanner.cpython-314.pyc`
- `backend/tests/__pycache__/test_sellers.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_streamlined_event_publishing.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_terms_acceptance.cpython-314-pytest-9.0.2.pyc`
- `backend/tests/__pycache__/test_webhooks.cpython-314-pytest-9.0.2.pyc`
