# Agent Operational Rules & Protocol

These rules apply to all coding-agent tasks in Highland Events Hub. Follow the owner's current request and the repository's other applicable instructions. If instructions conflict or essential information is missing, identify the conflict or blocker; do not silently choose a risky interpretation.

## 1. Context and source of truth

- **Read context first:** Read the root `events_hub_context.md` once at the start of a task. Read only the sections of `EVENT_FORM_REDESIGN_PLAN.md` and other reference documents relevant to that task; do not repeatedly reread long files or revisit completed audits.
- **Verify against code:** Context describes the project, but the current repository code and user-provided requirements determine actual behaviour. Report material discrepancies rather than assuming documentation is current.
- **Maintain context sparingly:** After a major architectural milestone is implemented and verified, update `events_hub_context.md` with a concise status summary. Do not update it for minor fixes, cosmetic changes, or every intermediate phase unless explicitly requested.

## 2. Surgical scope and reuse

- Identify the smallest set of files needed to deliver the requested outcome. Inspect only relevant code and dependencies.
- **Reuse before rebuilding:** Prefer existing components, APIs, validation, models, and business logic. Do not recreate functionality merely because a new interface is being built.
- Do not refactor, rename, reformat, clean up, or alter adjacent working code without a direct task requirement.
- **Protect layout and navigation:** Do not modify `Header.tsx`, `Navbar.tsx`, `Layout.tsx`, global navigation, or logos unless the task explicitly authorises changes to them.
- If a genuinely necessary change falls outside the authorised scope, explain it and stop for owner approval; do not cascade into unrelated routers, database models, or configuration.
- Deliver the complete requested feature, not an unrequested architecture exercise or an isolated fragment. Do not proceed to a subsequent feature automatically.

## 3. UI, assets, and brand preservation

- Preserve existing Tailwind classes, brand colours (including `#0B3B2C`), static image paths (`/images/...`), and established behaviour unless the task explicitly authorises changes in that area.
- When adding logic to an existing component, prefer small, targeted edits over rewriting its JSX tree.
- A task to redesign a **new form or specified component** authorises changes within that component only; it does not authorise a global redesign.
- Keep the existing live event-creation and editing flows working until their replacement is explicitly approved and verified.

## 4. Error and retry circuit breaker

- Make no more than **three focused correction attempts for the same failing check**. If it still fails, stop and report the error, attempted fixes, and the likely next step.
- Fix task-related failures within authorised files. Do not chase unrelated failures or expand scope to make an entire repository green.
- If fixing an error requires changes outside the authorised task scope, stop and explain the blocker rather than modifying those files.
- Do not hide failures by skipping tests, weakening assertions, suppressing errors, or claiming unperformed verification passed.

## 5. Efficient implementation and verification

- The owner has limited Codex usage. Prioritise a substantial, usable deliverable with proportionate verification; prompt length alone is not the measure of cost.
- Implement directly once the relevant code and requirements are understood. Avoid repeated audits, speculative improvements, unnecessary abstractions, new dependencies, and repeated documentation updates.
- **Browser testing belongs to the owner:** Do not run Playwright, browser automation, browser-based smoke tests, screenshots, responsive/visual reviews, or open browser tabs unless expressly requested.
- **Development servers belong to the owner:** Do not start a server unless essential to an expressly requested technical check. If you start one, terminate only the process you started before finishing; never terminate or disrupt a pre-existing server. State any exception or blocker.
- For routine frontend work, run TypeScript checking and narrowly relevant automated logic tests where useful. Do not automatically run production builds, complete suites, cross-browser matrices, or other expensive checks after every small change.
- For payment, authentication, inventory, database, and other high-risk backend work, use the appropriate focused and integration tests, including real PostgreSQL concurrency checks where relevant. Never trade correctness or financial safety for fewer tool calls.
- Do not run tests against production services, production data, live payment credentials, or an unverified database. Distinguish tests performed from manual checks left to the owner.

## 6. Repository and deployment safety

- Before editing, check relevant Git status and preserve unrelated user changes. Do not reset, overwrite, stage, or discard them.
- **Protected file:** Do not stage, overwrite, reset, or reconstruct `frontend/next-env.d.ts`. Avoid commands likely to regenerate it. If regeneration is unavoidable, preserve its exact original bytes beforehand and verify byte-for-byte restoration afterward; if that cannot be guaranteed, stop.
- Do not push, deploy, change production configuration, execute production migrations, enable production features, or initiate live Stripe operations without explicit owner authorisation for that specific action.
- Keep native ticketing/payment safeguards intact when working on the event form. Do not alter checkout, Stripe routing, recurrence persistence, or schema as an incidental UI change.
- Create a local commit only if the task requests one and verification is sufficient. Stage only authorised files; never force-push or rewrite shared history without specific authorisation.
- Never expose or commit credentials, personal data, or payment secrets.

## 7. Context limits and completion handoff

- If the session becomes too long or conflicting context prevents reliable work, notify the owner. Provide a **brief fresh-session handoff** only when needed, containing current branch/Git state, completed work, unresolved blockers, and the exact next task. Do not generate lengthy handoff documents by default.
- Once the requested deliverable and proportionate checks are complete, stop. Give a concise report covering: what changed; checks actually run and their results; what the owner should manually test; known blockers/limitations; commit hash if applicable; and final Git status.
- Never claim a feature was deployed, a migration ran, tests passed, or an external action succeeded without direct verification.
