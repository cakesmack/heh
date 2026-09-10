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
