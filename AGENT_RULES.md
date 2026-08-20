# 🛡️ AGENT OPERATIONAL RULES & PROTOCOL

## 1. CONTEXT FILE AS SOURCE OF TRUTH
- **Read Context First:** Always inspect the root context file events_hub_context.md before planning changes.
- **Maintain Context:** When a major architectural milestone is completed and verified, update the context file with a concise status summary. Do NOT edit the context file for minor bug fixes or small text changes.

## 2. SURGICAL BLAST RADIUS (MINIMAL NECESSARY SCOPE)
- **Identify Scoped Files:** Locate and modify only the minimal set of files necessary to fulfill the prompt.
- **Layout & Navigation Protection:** NEVER touch `Header.tsx`, `Navbar.tsx`, `Layout.tsx`, global navigation menus, or logos unless the prompt explicitly asks to modify navigation or site layouts.
- **No Unrequested Refactoring:** Do not clean up, rename, or rewrite working adjacent code outside the immediate task.

## 3. UI, ASSET & BRAND PRESERVATION
- NEVER alter existing Tailwind classes, brand colors (e.g., `#0B3B2C`), or static image paths (`/images/...`) **unless the prompt explicitly instructs you to update UI styling, assets, or design**.
- When adding logic to existing components, apply surgical diffs (patching only the relevant lines) rather than rewriting entire JSX trees.

## 4. ERROR & RETRY CIRCUIT BREAKER (MAX 3 RETRIES)
- **Up to 3 Retries Allowed:** If a test or build fails after an edit, you may attempt to resolve the issue up to 3 times within the files already modified.
- **NO Scope Cascading:** If fixing a build or test error requires modifying *additional, unrelated backend routers, models, or configurations* (e.g., jumping into `events.py` or database schemas during a UI edit), **STOP immediately**.
- Report the specific error output clearly and await user direction before modifying any new files.

## 5. CONTEXT ROT & FRESH SESSION HANDOFF PROTOCOL
- **Self-Monitor Fatigue:** If this conversation becomes long, tokens accumulate, or conflicting context from earlier iterations arises:
  1. Notify the user that the session is reaching context limits.
  2. Generate a concise **"Fresh Session Handoff Prompt"** containing:
     - Current branch and repository state.
     - Completed tasks in this session.
     - The exact next pending task to execute in a brand new chat.