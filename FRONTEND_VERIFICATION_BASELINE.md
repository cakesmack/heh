# Frontend verification baseline

**Date:** 10 September 2026

**Base commit:** `764ff0ab8cf8580c8395e5c33d4af019b7d56ddf` (`dev`)

**Scope:** Local frontend verification infrastructure before Batch 4. No application behaviour, backend source, migration, deployment configuration, or dead frontend component was changed.

## Toolchain and dependency state

| Item | Version or result |
|---|---|
| Operating system | Microsoft Windows `10.0.26200`, x64 |
| Node.js | `25.1.0` |
| npm | `11.6.2` |
| Next.js | `16.0.7`; locked engine requirement `>=20.9.0` |
| React / React DOM | `19.2.1` / `19.2.1` |
| TypeScript | `5.9.3` |
| Playwright | `1.58.2`; Chromium, Firefox, and WebKit binaries absent |
| Lockfile | npm lockfile v3; manifest ranges and all declared direct installed versions match the lock |

The initial installed tree contained two packages reported as extraneous: `@floating-ui/core@1.8.0` and `@floating-ui/utils@0.2.12`. The first `npm ci` attempt failed because a pre-existing Next development server held the Windows SWC binary open. That exact repository-local process tree was stopped, and the retry completed successfully without changing `package.json` or `package-lock.json`. A fresh `npm ci` reproduces the same two orphaned packages because both entries exist in the current lockfile without a declared parent. No package was upgraded and no audit fix ran. Correcting that lock anomaly would require a separately reviewed dependency metadata change.

The local Node runtime satisfies the installed and locked engine constraints. The repository's frontend Dockerfile remains on its existing Node version and was not changed or tested here.

## V2: explicit TypeScript typecheck

`frontend/package.json` now defines:

```text
"typecheck": "tsc --noEmit --incremental false"
```

Command:

```text
npm run typecheck
```

Result: exit code `2`, with **33 diagnostics in 7 files**.

| Code | Count | Classification |
|---|---:|---|
| `TS2300` | 2 | Generated-type/configuration conflict between `.next/types` and `.next/dev/types` |
| `TS2304` | 7 | Existing application type issue: missing authentication type names |
| `TS2339` | 22 | Existing application type issue: response/interface fields used but not declared |
| `TS2345` | 2 | Existing application type issue: collection date nullability mismatch |

Complete diagnostic locations:

* `.next/dev/types/validator.ts:7:6` — `TS2300`, duplicate `PagesPageConfig`.
* `.next/types/validator.ts:7:6` — `TS2300`, duplicate `PagesPageConfig`.
* `src/components/admin/CollectionsManager.tsx:409:67` — `TS2345`, `fixed_start_date` accepts `null` in the submitted object but `CollectionUpdate` permits only `string | undefined`.
* `src/components/admin/CollectionsManager.tsx:411:45` — `TS2345`, the same mismatch against `CollectionCreate`.
* `src/hooks/useAuth.tsx:16:41` — `TS2304`, `User` is not found.
* `src/hooks/useAuth.tsx:22:9` — `TS2304`, `User` is not found.
* `src/hooks/useAuth.tsx:26:24` — `TS2304`, `LoginRequest` is not found.
* `src/hooks/useAuth.tsx:28:20` — `TS2304`, `RegisterRequest` is not found.
* `src/hooks/useAuth.tsx:47:36` — `TS2304`, `User` is not found.
* `src/hooks/useAuth.tsx:95:49` — `TS2304`, `LoginRequest` is not found.
* `src/hooks/useAuth.tsx:129:45` — `TS2304`, `RegisterRequest` is not found.
* `src/pages/events/[id].tsx:657:24` — `TS2339`, `is_cancelled` is absent from `EventResponse`.
* `src/pages/events/[id].tsx:666:43` — `TS2339`, `is_cancelled` is absent from `EventResponse`.
* `src/pages/events/[id].tsx:682:22` — `TS2339`, `is_cancelled` is absent from `EventResponse`.
* `src/pages/events/[id].tsx:690:139` — `TS2339`, `is_cancelled` is absent from `EventResponse`.
* `src/pages/events/[id].tsx:695:22` — `TS2339`, `is_cancelled` is absent from `EventResponse`.
* `src/pages/events/[id].tsx:699:28` — `TS2339`, `cancellation_reason` is absent from `EventResponse`.
* `src/pages/events/[id].tsx:699:60` — `TS2339`, `cancellation_reason` is absent from `EventResponse`.
* `src/pages/events/[id].tsx:877:24` — `TS2339`, `is_cancelled` is absent from `EventResponse`.
* `src/pages/locations/[city].tsx:90:35` — `TS2339`, `partner_logo` is absent from the declared response type.
* `src/pages/locations/[city].tsx:91:35` — `TS2339`, `partner_name` is absent from the declared response type.
* `src/pages/locations/[city].tsx:92:34` — `TS2339`, `partner_url` is absent from the declared response type.
* `src/pages/organizers/invoices.tsx:144:11` — `TS2339`, `buyer_email` is absent from `InvoiceItem`.
* `src/pages/organizers/invoices.tsx:215:78` — `TS2339`, `total_gross` is absent from `InvoiceSummary`.
* `src/pages/organizers/invoices.tsx:216:70` — `TS2339`, `total_tickets` is absent from `InvoiceSummary`.
* `src/pages/organizers/invoices.tsx:221:79` — `TS2339`, `total_fees` is absent from `InvoiceSummary`.
* `src/pages/organizers/invoices.tsx:227:81` — `TS2339`, `total_net` is absent from `InvoiceSummary`.
* `src/pages/organizers/invoices.tsx:348:36` — `TS2339`, `order_id` is absent from `InvoiceItem`.
* `src/pages/organizers/invoices.tsx:354:43` — `TS2339`, `created_at` is absent from `InvoiceItem`.
* `src/pages/organizers/invoices.tsx:367:94` — `TS2339`, `buyer_email` is absent from `InvoiceItem`.
* `src/pages/organizers/invoices.tsx:370:32` — `TS2339`, `tickets_count` is absent from `InvoiceItem`.
* `src/pages/organizers/invoices.tsx:373:33` — `TS2339`, `total_gross` is absent from `InvoiceItem`.
* `src/pages/organizers/invoices.tsx:383:63` — `TS2339`, `order_id` is absent from `InvoiceItem`.

No application source was changed before the baseline. The application diagnostics therefore appear pre-existing. The generated duplicate is caused by both existing `.next` type trees being included; its durable resolution remains unreviewed. No diagnostic was suppressed or repaired.

## V3: production build and start

The preserved production build command is:

```text
npm run build
```

It invokes `next build --webpack`. `next.config.js` deliberately skips TypeScript validation during builds; build success would not replace V2.

The build ran with Next telemetry disabled, dummy or empty public identifiers, and API/base URLs restricted to unused loopback ports. Next reported discovery of the existing ignored `.env.local`; every variable from that file which is referenced by frontend source was already overridden in the command environment. Its additional `NEXT_PUBLIC_OS_API_KEY` name has no frontend source/config reference and was not used. No value from the file was printed. A temporary Node preload guard outside the repository rejected non-loopback socket and DNS operations. Guard self-tests proved that external `fetch` and DNS operations fail before connecting while numeric loopback connections are delegated.

Result: exit code `1`. `src/pages/_app.tsx` uses `next/font/google` for Inter. Next attempted to connect to `fonts.googleapis.com` three times; every attempt was blocked before network access, and compilation failed with `Failed to fetch Inter from Google Fonts`.

Warnings before failure:

* `baseline-browser-mapping` data is over two months old.
* Next 16 no longer recognises the `eslint` key in `next.config.js`.
* The `middleware` file convention is deprecated in favour of `proxy`.
* Type validation was skipped under the existing configuration.

PWA compilation generated ignored local `public/sw.js` and `public/workbox-4754cb34.js` output before the build failed. `.next/` output also remains ignored. The build failed before Next emitted a route table. None of these generated files is part of this baseline commit.

A production server was **not started** because a safe successful build does not exist. No production-start response or SSR output is claimed.

## Local browser smoke harness

Reachable Git history contains the introduction of `frontend/playwright.config.ts` but no former `frontend/tests` source. `frontend/tests/smoke.spec.ts` is therefore a new replacement safety harness, not a recovered historical test.

The configuration fixes `baseURL` to `http://127.0.0.1:43119`, uses one worker, and disables full parallel execution. The single Chromium test requests only a deliberately missing local path, checks the custom 404 page and shared header/footer, and records, aborts, and fails on every non-loopback browser request. It requires no login, API mutation, analytics action, payment action, or credential.

Collection command:

```text
node node_modules/@playwright/test/cli.js test tests/smoke.spec.ts --project=chromium --list
```

Collection result: exit code `0`; **1 test in 1 file**. Execution result: **blocked and not run** because V3 failed and the Playwright Chromium binary is not installed. A later run must first produce a safe build and install the declared Playwright browser without changing package versions.

## Protected generated files

Before any Next command, `frontend/next-env.d.ts` was backed up outside the repository. Its pre-task SHA-256 was `F41E9C5A66FE4DCE9688EC9848279A51F1AF1091D7BDB0A1E813E9661F26C77D`. The existing user change points the declaration at `.next/dev/types/routes.d.ts` instead of `.next/types/routes.d.ts`.

The build regenerated this file with SHA-256 `A4E5A5EAA42797D991185F51B45C18249925A895B49F5140AE8292831F9D1FC0`. It was immediately restored byte-for-byte from the private backup and again hashes to `F41E9C5A66FE4DCE9688EC9848279A51F1AF1091D7BDB0A1E813E9661F26C77D`. It remains unstaged.

Backup location:

```text
C:\Users\Craig\AppData\Local\Temp\highland_events_hub_frontend_baseline_20260910_180901
```

`frontend/tsconfig.tsbuildinfo` is tracked. It remained unchanged with SHA-256 `E35503BE6899E16C9B69E3D1872CD9FFF31A926A7D60EEA506E2FA68D94263D2`. The explicit typecheck disables incremental state, so that command does not need the cache. Its proposed Batch 1B deletion remains a separate decision.

## Network and credential safety

No real environment file was copied or printed. No production API, database, Stripe, email, Cloudflare, Google, analytics, or admin credential was supplied. The attempted Google Fonts connection was stopped by the local guard before DNS or socket completion. No live API request, data mutation, payment action, application crawl, backend test, migration, or deployment occurred.

## Remaining blockers before Batch 4

All Batch 4 groups remain blocked because the cleanup plan requires V2 and V3 for every group:

1. Resolve and re-baseline the 33 TypeScript diagnostics without weakening compiler settings.
2. Decide how a production build obtains Inter without requiring uncontrolled external network access, then establish a successful guarded build and loopback-only production start.
3. Install the declared Chromium browser and run the one-test smoke harness only after V3 succeeds.
4. Obtain the cleanup plan's owner confirmation that no unpublished or external source consumers depend on proposed deletion targets.
5. Preserve the established isolated backend baseline of 75/75; it was not rerun because no backend file changed.

## V3 completion: controlled build, production start, and smoke

**Completion date:** 10 September 2026

The original baseline above is preserved as the record of the first restricted run. A second build used a repository-local Node preload guard in build mode. That mode allowed DNS and socket access only for the two exact hosts required by the existing `next/font/google` Inter configuration:

* `fonts.googleapis.com`
* `fonts.gstatic.com`

An uncached successful build recorded one DNS lookup and one connection attempt for `fonts.googleapis.com`, and seven DNS lookups and seven connection attempts for `fonts.gstatic.com`. It recorded no other external hostname and blocked no unexpected destination. A repeat build completed from cache without external access. The exception applied only to the build process; production-server and browser execution retained loopback-only policies. The guard is implemented in `frontend/tests/support/network-guard.cjs` and is verification infrastructure, not an application runtime requirement.

### Production build result

`npm run build` completed successfully with exit code `0` in 28.85 seconds on the captured repeat. It compiled the server and client PWA bundles, generated ignored `public/sw.js` and `public/workbox-4754cb34.js`, used scope `/`, generated 60 static pages, and emitted a complete Pages Router table containing **72 routable page entries**, the non-route `/_app` entry, and the middleware/proxy entry. The build produced `.next/BUILD_ID` and the expected manifests.

Warnings remained non-fatal:

* `baseline-browser-mapping` data is old.
* Next 16 does not recognise the existing `eslint` key in `next.config.js`.
* The `middleware` convention is deprecated in favour of `proxy`.
* TypeScript validation remains skipped by the existing build configuration.
* Browserslist reported that `caniuse-lite` data is nine months old.

The successful build does not change the V2 result: the explicit typecheck still fails with the diagnostics classified below.

### Production start result

The generated production build started successfully with the installed Next CLI, bound only to `http://127.0.0.1:43119`, and became ready in approximately 1.5 seconds. A request to a deliberately missing local route returned the custom HTML 404 response with HTTP `404`. The server-side guard recorded no external request. The server was stopped cleanly, and a follow-up request confirmed that the port was no longer accepting connections.

### Chromium and smoke result

The project-installed Playwright CLI installed only the Chromium browser required by Playwright 1.58.2. It did not change `package.json` or `package-lock.json` and did not install Firefox or WebKit. The installed headless Chromium version is `145.0.7632.6`.

The focused command was:

```text
node node_modules/@playwright/test/cli.js test tests/smoke.spec.ts --project=chromium --workers=1 --reporter=line
```

Result: **1 test collected, 1 passed, 0 failed, 0 skipped** in 2.4 seconds against `http://127.0.0.1:43119`. The browser attempted no non-loopback request. The smoke server also recorded no external request. No browser or server destination had to be blocked.

## V2 diagnostic reachability analysis

A fresh TypeScript-AST dependency graph used all Pages Router pages and middleware as roots and followed static imports, literal dynamic imports, CommonJS `require` calls, and re-exports. It examined 240 source modules and 637 dependency edges: 199 modules are route-reachable and 41 are unreachable. The only unresolved local reference was the expected CSS import `@/styles/globals.css`, outside the TypeScript-only graph. The 41-module result and membership exactly match the current Batch 4 graph in `REPOSITORY_CLEANUP_PLAN.md`; config and literal-reference review found no change to those classifications.

| Diagnostic file | Count and codes | Classification | Inbound reference / nearest route root | Batch 4 effect |
|---|---|---|---|---|
| `.next/dev/types/validator.ts` | 1 × `TS2300` | **D. VERIFICATION-ONLY** | Generated by Next; included by `tsconfig.json` | No cleanup group; does not disappear through Batch 4 |
| `.next/types/validator.ts` | 1 × `TS2300` | **D. VERIFICATION-ONLY** | Generated by Next; included by `tsconfig.json` | No cleanup group; does not disappear through Batch 4 |
| `src/components/admin/CollectionsManager.tsx` | 2 × `TS2345` | **A. LIVE / ROUTE-REACHABLE** | Imported by `src/pages/admin/curated.tsx`; nearest root `/admin/curated` | No cleanup group; remains a V2 prerequisite for every group |
| `src/hooks/useAuth.tsx` | 7 × `TS2304` | **A. LIVE / ROUTE-REACHABLE** | Imported directly by `src/pages/_app.tsx` and broadly by live pages/components; nearest root `_app` | No cleanup group; remains a V2 prerequisite for every group |
| `src/pages/events/[id].tsx` | 8 × `TS2339` | **A. LIVE / ROUTE-REACHABLE** | Pages Router root `/events/[id]` | No cleanup group; remains a V2 prerequisite for every group |
| `src/pages/locations/[city].tsx` | 3 × `TS2339` | **A. LIVE / ROUTE-REACHABLE** | Pages Router root `/locations/[city]`; also imported by `/locations/[city]/[timeframe]` | No cleanup group; remains a V2 prerequisite for every group |
| `src/pages/organizers/invoices.tsx` | 11 × `TS2339` | **A. LIVE / ROUTE-REACHABLE** | Pages Router root `/organizers/invoices` | No cleanup group; remains a V2 prerequisite for every group |

Diagnostic totals by classification are **31 LIVE diagnostics in 5 files**, **0 DEAD**, **0 COMPATIBILITY SAFEGUARD**, **2 VERIFICATION-ONLY diagnostics in 2 generated files**, and **0 UNCERTAIN**. Therefore no diagnostic would naturally disappear through any approved G1-G13 dead-code deletion. None originates in the G14 compatibility safeguards. The diagnostics do not block one particular cleanup group by dependency; the cleanup plan's global V2 gate blocks all Batch 4 groups until the baseline passes.

### Root causes and later minimum fixes

The 33 messages reduce to six independent causes:

1. **Generated validator collision (2 cascading diagnostics).** `.next/dev/types/validator.ts` and `.next/types/validator.ts` both declare the global `PagesPageConfig`, while `tsconfig.json` includes both trees. A later verification/configuration task should establish one clean generated-type input for explicit typecheck rather than suppressing the errors. Expected runtime behaviour is unchanged; risk is low and limited to verification/build configuration.
2. **Missing authentication type imports (7 cascading diagnostics).** `User`, `LoginRequest`, and `RegisterRequest` are exported by `src/types/index.ts` but are not imported by `src/hooks/useAuth.tsx`. A later type-only import in that hook should resolve this group without runtime change. Risk is low, but the affected flow is global authentication, including login and registration.
3. **Collection date nullability (2 cascading diagnostics).** `CollectionsManager` submits `null` for cleared fixed dates; the backend schema explicitly accepts nullable dates, while frontend `CollectionCreate` and `CollectionUpdate` permit only `string | undefined`. A later correction should align the two frontend fields with the nullable API contract, after confirming create/update serialization. Runtime behaviour should remain unchanged. Risk is low to medium; the affected flow is admin curated-collection creation and editing.
4. **Event cancellation response shape (8 cascading diagnostics).** The live event page uses `is_cancelled` and `cancellation_reason`, which are supplied by the backend response but absent from frontend `EventResponse`. A later type-only addition in `src/types/index.ts` should align the response contract. Runtime behaviour should remain unchanged. Risk is low to medium because the event detail page includes SSR/SEO output and cancellation messaging; it does not require changes to event creation, editing, moderation, terms acceptance, venue editing, maps, or ticket execution.
5. **Location partner response shape (3 cascading diagnostics).** The backend location feed returns nullable `partner_logo`, `partner_name`, and `partner_url`, while the inline return type of `locationsAPI.getFeed` omits them. A later type-only update in `src/lib/api.ts` should match the backend contract. Runtime behaviour should remain unchanged. Risk is low to medium; the affected flow is location SSR/SEO and partner display, including the timeframe route that imports the same page.
6. **Organizer invoice response shape (11 cascading diagnostics).** The local page interfaces use stale names such as `gross_sales`, `issue_date`, and `gross_amount`; the backend returns `total_gross`, `total_fees`, `total_net`, `total_tickets`, `order_id`, `created_at`, `buyer_email`, and `tickets_count`, matching the page's actual reads. A later change should replace the local interfaces with the exact API response contract, preferably as a shared typed response. Runtime behaviour should remain unchanged. Risk is medium because the flow covers organizer invoices, ticket-sale accounting, tax-year filtering, CSV export, and invoice navigation.

The minimum remediation sequence before Batch 4 is: resolve the generated-type collision first so V2 measures application code cleanly; add the missing auth type imports; align the collection, event, and location API contracts; align the organizer invoice response contract; then rerun explicit typecheck, the controlled build/start, and the focused smoke test. This is six independent fixes, five in live type declarations/imports and one in verification/generated-type configuration. No diagnostic was fixed or suppressed during this task.

## Completion safety record

Only `fonts.googleapis.com` and `fonts.gstatic.com` were contacted by the controlled build. The Chromium download was the only other authorised external network activity. Production server and browser traffic remained loopback-only. No production API, database, payment, email, analytics, or administrative operation was contacted or performed. No dead code or application source was changed, and no backend file, migration, deployment file, font configuration, or dependency manifest changed. The established backend result remains 75/75; it was not rerun because this task changed no backend source or test infrastructure.

`frontend/next-env.d.ts` was freshly backed up before this completion run. Next regenerated it during build, after which its exact pre-task bytes were restored immediately. Its final SHA-256 remains `F41E9C5A66FE4DCE9688EC9848279A51F1AF1091D7BDB0A1E813E9661F26C77D`, and it remains unstaged.

Completion-run backup location:

```text
C:\Users\Craig\AppData\Local\Temp\highland_events_hub_v3_completion_20260910_190545
```

## Initial type-blocker remediation

**Remediation date:** 10 September 2026

This scoped remediation addressed only the two generated-validator diagnostics and the seven missing authentication type references. Collection, event, location, and organizer-invoice diagnostics remain unchanged.

### Generated validator collision

Next 16 enables `experimental.isolatedDevBuild` by default. Development output is therefore generated under `.next/dev`, while `next typegen` and production builds generate types under `.next/types`. The existing `tsconfig.json` selected both trees explicitly and also matched them through its broad TypeScript globs. Consequently, `.next/dev/types/validator.ts` and `.next/types/validator.ts` were compiled together; each declares the same top-level `PagesPageConfig` type and produced one `TS2300` duplicate-identifier diagnostic.

The durable correction keeps `.next/types/**/*.ts` as the supported production/typegen input, removes the explicit `.next/dev/types/**/*.ts` include, and excludes the isolated development type tree from wildcard discovery by external `tsc`. The protected `next-env.d.ts` still directly imports `.next/dev/types/routes.d.ts`, so that compatible route declaration remains reachable; the final compiler file list contains the two route declaration files and only the production `.next/types/validator.ts`. Application source coverage, compiler strictness, and the Next TypeScript plugin remain unchanged. No generated validator was edited or committed, and no diagnostic suppression was added.

The installed command:

```text
node node_modules/next/dist/bin/next typegen
```

completed successfully without network access and regenerated `.next/types`. The following `npm run typecheck` reported 31 diagnostics and no diagnostic from either generated validator, proving that both `TS2300` errors disappeared while the production/typegen types remained included.

### Authentication type references

All seven `useAuth.tsx` diagnostics were missing-name errors for three existing canonical types:

* `User`, used by seller eligibility, auth context state, and provider state.
* `LoginRequest`, used by the context login signature and login callback.
* `RegisterRequest`, used by the context registration signature and registration callback.

These definitions already exist in `src/types/index.ts`. The authentication API client imports and uses the same `LoginRequest` and `RegisterRequest` payloads, returns the existing `TokenResponse`, and exposes the current-user response as `UserProfile`, which extends `User`. The only application-source change was a type-only import of `User`, `LoginRequest`, and `RegisterRequest` into `src/hooks/useAuth.tsx`. No storage, token, cookie, redirect, login, logout, registration, Google authentication, bookmark, provider, or backend behavior changed.

### V2 result

| Measurement | Before | After |
|---|---:|---:|
| Diagnostics | 33 | 24 |
| Files | 7 | 4 |
| Generated validator diagnostics | 2 | 0 |
| `useAuth.tsx` diagnostics | 7 | 0 |

The 24 remaining diagnostics are the four explicitly deferred root causes:

| File | Count | Root cause |
|---|---:|---|
| `src/components/admin/CollectionsManager.tsx` | 2 × `TS2345` | Collection fixed-date nullability |
| `src/pages/events/[id].tsx` | 8 × `TS2339` | Missing event cancellation response fields |
| `src/pages/locations/[city].tsx` | 3 × `TS2339` | Missing location partner response fields |
| `src/pages/organizers/invoices.tsx` | 11 × `TS2339` | Stale organizer-invoice response interfaces |

No new diagnostic appeared elsewhere.

### V3 regression result

The controlled build passed with exit code `0` in 40.8 seconds. The successful run contacted only `fonts.googleapis.com` and `fonts.gstatic.com`, under the same exact build-only allowlist. A preliminary sandboxed attempt safely blocked an npm update-check connection to `registry.npmjs.org`; the connection did not succeed, the allowlist was not broadened, and the sandbox prevented the authorised font retrieval in that attempt. The successful rerun recorded no unexpected destination.

The production server then started on `http://127.0.0.1:43119`, became ready in 1.555 seconds, and returned HTTP `404` for the deliberate local smoke route. The focused Chromium run collected one test and passed one test in 1.8 seconds. Server and test-runner network logs were empty, and the server was stopped with no remaining listener on port 43119.

Before any Next command, `frontend/next-env.d.ts` was backed up outside the repository with SHA-256 `F41E9C5A66FE4DCE9688EC9848279A51F1AF1091D7BDB0A1E813E9661F26C77D`. It was restored after type generation and build and retains that exact final hash. The user's pre-existing change remains unstaged.

Remediation backup and captured verification evidence:

```text
C:\Users\Craig\AppData\Local\Temp\heh_initial_type_blockers_20260910_193054
```

## Collection fixed-date type remediation

**Remediation date:** 10 September 2026

This remediation addressed only the two `CollectionsManager.tsx` diagnostics:

* `src/components/admin/CollectionsManager.tsx:409:67` — `TS2345`: the update payload contained `fixed_start_date: string | null`, while `CollectionUpdate` allowed only `string | undefined`.
* `src/components/admin/CollectionsManager.tsx:411:45` — `TS2345`: the create payload contained `fixed_start_date: string | null`, while `CollectionCreate` allowed only `string | undefined`.

The same structural mismatch covered both `fixed_start_date` and `fixed_end_date`. The backend model stores both as nullable dates. `CollectionCreate`, `CollectionUpdate`, and the response schema define both as `Optional[date] = None`; empty or whitespace strings are explicitly coerced to `None`. Update handling uses `model_dump(exclude_unset=True)`, so an omitted field leaves its stored value unchanged while an explicit `null` clears it. FastAPI serializes a populated date as an ISO `YYYY-MM-DD` string and an absent date as JSON `null`. Existing backend tests verify creation with empty values, updates with valid ISO dates, and clearing both dates back to `null`.

The UI already implements that contract. Its date inputs hold strings, edit initialization maps a null or missing response to `''`, and submission maps an empty input to `null`. The API functions pass the object through `JSON.stringify` without renaming or transforming either field.

The canonical frontend declarations in `src/types/index.ts` were corrected as follows:

* Collection responses: `fixed_start_date` and `fixed_end_date` are `string | null`.
* Create/update inputs: both fields are optional `string | null`, allowing omission, a valid ISO string, or explicit clearing with `null`.

No `CollectionsManager.tsx` implementation, request body, API URL, permission check, collection date calculation, visibility rule, event-membership query, geographic bound, ordering, or analytics behavior changed. No assertion, cast, fallback date, backend change, model change, or migration was introduced.

### Verification result

V2 improved from **24 diagnostics across 4 files** to **22 diagnostics across 3 files**. Both collection diagnostics disappeared and no new diagnostic appeared. The remaining diagnostics are unchanged:

| File | Count | Root cause |
|---|---:|---|
| `src/pages/events/[id].tsx` | 8 × `TS2339` | Missing event cancellation response fields |
| `src/pages/locations/[city].tsx` | 3 × `TS2339` | Missing location partner response fields |
| `src/pages/organizers/invoices.tsx` | 11 × `TS2339` | Stale organizer-invoice response interfaces |

The controlled production build passed with exit code `0` in 28.03 seconds. It reused the local font cache and made no external request; the build-only policy still authorised only `fonts.googleapis.com` and `fonts.gstatic.com`. The production server started on `http://127.0.0.1:43119`, became ready in 1.581 seconds, and returned HTTP `404` for the deliberate local route. The focused Chromium smoke collected one test and passed one test in 1.9 seconds. Server and browser-runner network logs were empty.

Two preliminary server starts encountered `EADDRINUSE` because a Next process from the preceding verification task still held the fixed smoke port. That repository-owned stale process was identified by its start time and executable, stopped, and the clean start/smoke cycle then passed. The final server was stopped and `netstat` confirmed no listener remained on port 43119.

Before the build, `frontend/next-env.d.ts` was backed up outside the repository. Its pre-task and final SHA-256 are both `F41E9C5A66FE4DCE9688EC9848279A51F1AF1091D7BDB0A1E813E9661F26C77D`; the user's pre-existing modification remains unstaged. Backend source remains unchanged, so the established backend baseline remains 75/75 without a rerun.

Captured verification evidence:

```text
C:\Users\Craig\AppData\Local\Temp\heh_collection_date_types_20260910
```

## Event and location response type remediation

**Remediation date:** 11 September 2026

This remediation addressed the 11 live-page diagnostics deferred from the previous baseline: eight `TS2339` diagnostics in `src/pages/events/[id].tsx` and three `TS2339` diagnostics in `src/pages/locations/[city].tsx`.

The event-detail diagnostics were reads of `is_cancelled` at lines 657, 666, 682, 690, 695, and 877, plus two reads of `cancellation_reason` at line 699. The public `GET /api/events/{event_id}` endpoint uses the backend `EventResponse` schema. That schema always serializes `is_cancelled` as a boolean and serializes `cancellation_reason`, `cancelled_at`, and `previous_date_start` as a string or JSON `null`; the datetime values use the API's ISO datetime serialization. The current public contract has no replacement-event reference. The organizer update input is a separate schema and was not used as evidence for the public page. The shared frontend `EventResponse` omitted all four cancellation/reschedule response fields, so it was extended with the existing backend field names and nullable string forms. The fields remain optional in this broad shared frontend interface because it is also used for locally constructed previews and other event projections; the public detail endpoint itself always supplies them.

The location diagnostics were reads of `partner_logo`, `partner_name`, and `partner_url` at lines 90-92. Both public location-feed routes use `LocationFeedResponse`, whose three partner fields are nullable strings. The endpoint explicitly assigns every field from the matching location record or `None`, so FastAPI always serializes each key with a string or JSON `null`, including fallback feeds. The inline return contract of `locationsAPI.getFeed` was the canonical client declaration for this endpoint and omitted those fields. It now declares all three as required nullable strings.

Only `src/types/index.ts` and `src/lib/api.ts` application declarations changed. Event fetching, cancellation messaging, reschedule data, ticket gating and links, status handling, dates, venue/location output, redirects, query handling, SEO, JSON-LD, location fetching, partner rendering, event filters/listing, maps, and SSR were not changed. No backend source, API response, request payload, ticketing/payment code, invoice code, assertion, cast, `any`, or runtime branch was added or modified.

### Verification result

V2 improved from **22 diagnostics across 3 files** to **11 diagnostics in 1 file**. Both target pages now have zero diagnostics, and no new diagnostic file appeared. The 11 remaining `TS2339` diagnostics are all in the explicitly deferred `src/pages/organizers/invoices.tsx` contract.

The targeted isolated backend checks passed: `backend/tests/test_cancellation_and_reschedule.py` contributed two passing tests and `backend/tests/test_location_hubs.py` contributed one, for **3 passed**. They used the existing in-memory test isolation; no real database, migration, or network service was used. The established full backend baseline remains 75/75.

The final controlled production build passed with exit code `0`. The build ran with the two public Google client variables explicitly empty so the existing credential-free smoke environment did not initialize Google Maps or Google sign-in providers. The font-only build allowlist remained in force; the final build used the local font cache, blocked two npm update-check attempts to `registry.npmjs.org`, and completed without a successful external request. An earlier sandboxed build attempt could not fetch the allowed Google font, and an initial build that inherited local public client values was rejected by the smoke harness after it intercepted Google Maps and Google sign-in script requests. No intercepted request completed, the allowlist was not expanded, and no application file was changed in response.

The final production server started on `http://127.0.0.1:43119`, became ready in 1.314 seconds, and returned HTTP `404` for the deliberate local route. The focused Chromium smoke collected one test and passed one test in 1.6 seconds. The final server and browser-runner network logs were empty. The verified Node server process was stopped, and no listener remained on port 43119.

Before any Next command, `frontend/next-env.d.ts` was backed up outside the repository. Its pre-task and final SHA-256 are both `F41E9C5A66FE4DCE9688EC9848279A51F1AF1091D7BDB0A1E813E9661F26C77D`; the user's existing modification remains unstaged.

Captured verification evidence:

```text
C:\Users\Craig\AppData\Local\Temp\heh_event_location_types_20260910
```
