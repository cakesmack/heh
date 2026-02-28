# Backend Audit Report

## Phase 1: Database & Models

**Scope:** All 30 files in `backend/app/models/`
**Date:** 2026-02-10
**Auditor:** Antigravity (Senior Database Architect role)

---

### Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High | 8 |
| 🟡 Medium | 12 |
| 🔵 Low | 5 |

---

### 1. Duplicate Prevention (Critical)

| File | Model | Severity | Issue | Recommended Fix |
|------|-------|----------|-------|-----------------|
| `event.py` | `Event` | 🔴 Critical | **No UniqueConstraint on title + date + venue.** Nothing prevents the exact same event being created twice (e.g. duplicate scraper runs, double-click submissions). | Add `__table_args__ = (UniqueConstraint("title", "date_start", "venue_id", name="uq_event_title_date_venue"),)` |
| `bookmark.py` | `Bookmark` | 🟠 High | **No UniqueConstraint on user_id + event_id.** A user can bookmark the same event multiple times, creating duplicate rows. | Add `__table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_user_event_bookmark"),)` |
| `follow.py` | `Follow` | 🟠 High | **No UniqueConstraint on follower_id + target_id + target_type.** A user can follow the same venue/organizer multiple times. | Add `__table_args__ = (UniqueConstraint("follower_id", "target_id", "target_type", name="uq_user_follow"),)` |
| `user_category_follow.py` | `UserCategoryFollow` | 🟡 Medium | Composite PK (`user_id`, `category_id`) prevents exact duplicates at DB level — **OK**. However, no `ondelete` cascade if the category or user is deleted. | Add `ondelete="CASCADE"` to both FK definitions. |
| `venue_staff.py` | `VenueStaff` | 🟠 High | **No UniqueConstraint on venue_id + user_id.** Same user can be added as staff to the same venue multiple times. | Add `__table_args__ = (UniqueConstraint("venue_id", "user_id", name="uq_venue_staff"),)` |
| `venue_claim.py` | `VenueClaim` | 🟡 Medium | **No UniqueConstraint on venue_id + user_id + status="pending".** A user could submit multiple pending claims for the same venue. | Add application-level or partial unique index check. |
| `event_claim.py` | `EventClaim` | 🟡 Medium | Same issue as `VenueClaim` — no constraint preventing duplicate pending claims. | Add application-level or partial unique index check. |

---

### 2. Orphaned Relationships

| File | Model | Severity | Issue | Recommended Fix |
|------|-------|----------|-------|-----------------|
| `venue.py` | `Venue` | 🔴 Critical | **Duplicate field declaration:** `name` is defined twice (lines 48–49). SQLAlchemy silently uses the last definition. This is a code defect waiting to cause confusion. | Remove the duplicate `name: str = Field(...)` on line 49. |
| `venue.py` | `Venue` | 🟠 High | **No `ondelete` on `owner_id` FK.** If a `User` is deleted, owned venues have a dangling `owner_id` pointing to a nonexistent user. | Change to `sa_column=Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)` |
| `venue.py` | `Venue` | 🟡 Medium | **No `ondelete` on `category_id` FK** (`foreign_key="venue_categories.id"`). Deleting a VenueCategory leaves orphaned references. | Add `ondelete="SET NULL"` to the FK definition. |
| `featured_booking.py` | `FeaturedBooking` | 🟠 High | `event` relationship has **no `back_populates`**. Event model has no corresponding `featured_bookings` relationship. Means you can't traverse `event.featured_bookings` and cascade behaviour is one-way only. | Add `back_populates="featured_bookings"` and add matching `featured_bookings` list relationship on `Event`. |
| `event_claim.py` | `EventClaim` | 🟠 High | `event` and `user` relationships have **no `back_populates`**. No cascade defined — deleting an Event won't auto-delete its claims. | Add `back_populates` and `ondelete="CASCADE"` on the FKs. |
| `venue_claim.py` | `VenueClaim` | 🟠 High | `venue` and `user` relationships have **no `back_populates`**. No cascade or `ondelete` on FKs — deleting a venue leaves orphaned claim rows. | Add `back_populates` and `ondelete="CASCADE"` on `venue_id`, `ondelete="SET NULL"` on `user_id`. |
| `hero.py` | `HeroSlot` | 🟡 Medium | `event` relationship has **no `back_populates`**. No `ondelete` on `event_id` FK — deleting an event leaves a hero slot pointing to nothing. | Add `ondelete="SET NULL"` on the FK and `back_populates` if desired. |
| `venue_staff.py` | `VenueStaff` | 🟡 Medium | `venue` and `user` relationships exist but **no `back_populates` on `Venue.staff`** — wait, `Venue` does have `staff: list["VenueStaff"]`. However, `VenueStaff.venue` uses `Relationship()` without `back_populates="staff"` matching has been verified. **The issue is: no `ondelete` on venue_id or user_id FKs.** Deleting a venue doesn't cascade-remove staff entries. | Add `ondelete="CASCADE"` to both FKs. |
| `venue_invite.py` | `VenueInvite` | 🟡 Medium | **No relationships defined at all.** No `ondelete` on `venue_id` or `claimed_by_user_id` FKs. Deleting a venue leaves orphaned invite rows. | Add `ondelete="CASCADE"` on `venue_id` and `ondelete="SET NULL"` on `claimed_by_user_id`. |
| `event_participating_venue.py` | `EventParticipatingVenue` | 🟡 Medium | **No `ondelete` on either FK.** If an event or venue is deleted, orphaned link rows remain. | Add `ondelete="CASCADE"` to both `event_id` and `venue_id` FKs. |
| `payment.py` | `Payment` | 🟡 Medium | **`event_id` has no FK constraint** — it's just an indexed `Optional[str]` with no `foreign_key=` declaration. No referential integrity on event payments. | Add `foreign_key="events.id"` with `ondelete="SET NULL"`. |
| `group_member.py` | `GroupMember` | 🟡 Medium | **No `ondelete` on group_id or user_id FKs.** Deleting an organizer group doesn't cascade-remove memberships. | Add `ondelete="CASCADE"` to both FKs. |
| `group_invite.py` | `GroupInvite` | 🟡 Medium | **No `ondelete` on `group_id` FK.** Deleting an organizer group leaves orphaned invite tokens. | Add `ondelete="CASCADE"` to the FK. |

---

### 3. Field Efficiency

| File | Model | Severity | Issue | Recommended Fix |
|------|-------|----------|-------|-----------------|
| `analytics.py` | `AnalyticsEvent` | 🟠 High | **`url: str` has no `max_length`** — unbounded `String` column. On Postgres this is `TEXT`, on others it may be `VARCHAR(MAX)`. This table will grow rapidly; unbounded columns hurt index performance. | Add `max_length=2000` (or appropriate limit). |
| `analytics.py` | `AnalyticsEvent` | 🟡 Medium | **`event_type: str` and `session_id: str` have no `max_length`** — unbounded String columns. | Add `max_length=50` for `event_type` and `max_length=64` for `session_id`. |
| `collection.py` | `Collection` | 🟡 Medium | **`target_link: str` has no `max_length`** — unbounded String. | Add `max_length=500`. |
| `report.py` | `Report` | 🔴 Critical | **`reason: str` and `details: Optional[str]` have no `max_length`**, and `details` uses bare `= None` instead of `Field(default=None)`.** `resolved_by: Optional[str]` also bare assignment. These bypass SQLModel's field validation entirely. | Use `Field(default=None, max_length=...)` for all fields. Add FK references for `reporter_id` and `resolved_by` if they reference users. |
| `report.py` | `Report` | 🟡 Medium | **`target_type` and `status` use bare `str`** instead of an Enum. No enforcement of valid values at DB level. | Create `ReportTargetType` and `ReportStatus` enums. |
| `organizer.py` | `Organizer` | 🟡 Medium | **`slug: str` has no `max_length`** — unbounded String. | Add `max_length=255`. |
| `venue.py` | `Venue` | 🔵 Low | **Redundant fields:** Both `website` (line 63) **and** `website_url` (line 91) exist. Two columns for presumably the same data. | Consolidate to a single `website_url` field; migrate data from `website`. |
| `venue.py` | `Venue` | 🔵 Low | **Redundant address fields:** Both `address` (line 50) **and** `address_full` (line 72) exist. Likely `address_full` was added later as a "Phase 2.10 addition." | Consolidate to `address_full`; migrate data from `address`. |
| `event.py` | `Event` | 🔵 Low | **`status` uses bare `str` with comment.** No Enum enforcement at DB level for `published/pending/rejected/draft`. | Create an `EventStatus` enum for type safety. |
| `slot_pricing.py` | `SlotPricing` | 🔵 Low | **`slot_type` is `str` primary key** but conceptually maps to `SlotType` enum. The import of `SlotType` from `featured_booking` exists but isn't used on the field itself. | Change field type to `SlotType` for consistency, or add a CheckConstraint. |
| `slot_pricing.py` | `SlotPricing` | 🔵 Low | **`description: Optional[str]` has no `max_length`** — unbounded String. | Add `max_length=500`. |

---

### 4. Legacy Bloat

| File | Model | Severity | Issue | Recommended Fix |
|------|-------|----------|-------|-----------------|
| `event.py` | `Event` | 🟡 Medium | **`price: float` marked as "Legacy - keeping for backward compatibility"** alongside the newer `price_display` and `min_price` fields. Three fields for price is confusing and error-prone. | Plan migration to remove `price` once `min_price` is fully adopted. |
| `event.py` | `Event` | 🟡 Medium | **`age_restriction: Optional[str]` marked as "Legacy - keeping for compatibility"** alongside the newer `min_age: Optional[int]`. Duplication invites inconsistency. | Plan migration to remove `age_restriction` once `min_age` is fully adopted. |
| `event.py` | `Event` | 🟡 Medium | **`parent_event_id` has no FK constraint.** It stores a UUID referencing another Event but has no `foreign_key="events.id"`. No referential integrity. | Add `foreign_key="events.id"` with `ondelete="SET NULL"`. |
| `organizer.py` | `Organizer` | 🟡 Medium | **`social_links: Optional[dict]` (JSON blob) marked "legacy"** alongside individual `social_facebook`, `social_instagram`, `social_website` fields. Dual storage risks data desync. | Remove `social_links` JSON blob; migrate any remaining data to individual fields. |
| `organizer.py` | `Organizer` | 🟡 Medium | **Both `website_url` and `social_website` exist.** Redundant — likely `social_website` was added during profile enhancement, duplicating `website_url`. | Consolidate to `website_url`; remove `social_website`. |

---

### Priority Action Plan

#### Immediate (Pre-Alpha / Blocking)
1. **Add UniqueConstraint to `Event`** for `title + date_start + venue_id` — prevents duplicate creation from scrapers and double submissions.
2. **Fix duplicate `name` field in `Venue`** — remove the redundant line 49 declaration.
3. **Add UniqueConstraint to `Bookmark`** for `user_id + event_id`.
4. **Fix `Report` model** — replace bare assignments with proper `Field()` calls and add `max_length`.

#### Short-Term (Before Beta)
5. Add `UniqueConstraint` to `Follow` and `VenueStaff`.
6. Add `ondelete` cascades to all FK definitions lacking them (12+ fixes).
7. Add `back_populates` to orphaned relationships (`FeaturedBooking.event`, `EventClaim`, `VenueClaim`, `HeroSlot`).
8. Add `max_length` to all unbounded `String` fields in `AnalyticsEvent`, `Collection`, `Organizer.slug`, `SlotPricing.description`.

#### Tech Debt (Planned Sprint)
9. Remove legacy `price` and `age_restriction` fields from `Event` after migration.
10. Consolidate redundant `website`/`website_url` and `address`/`address_full` in `Venue`.
11. Remove legacy `social_links` JSON from `Organizer`.
12. Add Enum types for `Event.status`, `Report.target_type`, `Report.status`.
13. Add FK constraint to `Event.parent_event_id` and `Payment.event_id`.

---

## Phase 2: Logic & Services

**Scope:** All files in `backend/app/services/` and `backend/app/api/` (CRUD is embedded in routers)
**Date:** 2026-02-10
**Auditor:** Antigravity (Senior Backend Architect role)

---

### Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High | 7 |
| 🟡 Medium | 6 |
| 🔵 Low | 3 |

---

### 1. Swallowed Errors (Critical)

Broad `except Exception` blocks that silently catch and discard errors, masking bugs in production.

| File | Line(s) | Severity | Context | Risk |
|------|---------|----------|---------|------|
| `services/recurrence.py` | 83, 180 | 🔴 Critical | RRULE parsing error is caught and silently `pass`ed (L83). The **entire** function is wrapped in `except Exception` that logs-and-continues (L180) — if child event creation fails partway, **partial data is committed** with no rollback. | Data corruption: Some child events created, others silently dropped. No caller knows generation failed. |
| `services/notifications.py` | 43 | 🟠 High | `create_in_app_notification` catches `Exception` and logs only. Callers (moderation, admin claim approval) assume notification was created. | Silent notification loss — users never learn their event was approved/rejected. |
| `services/cloudinary_service.py` | 138, 161 | 🟡 Medium | `delete_image` returns `False` on any error; `extract_public_id` returns `None`. Acceptable for non-critical helpers, but caller never knows *why* deletion failed. | Orphaned Cloudinary assets accumulate over time. |
| `services/moderation.py` | 33, 54, 99 | 🟡 Medium | All three public functions catch `Exception` and return safe defaults (`False`, original text, `{flagged: False}`). Documented as "fail safe" — offensive content would slip through during library errors. | Profanity filter silently disabled during errors. |
| `services/postcode_service.py` | 141, 219 | 🟡 Medium | HTTP errors from Postcodes.io and Google Geocode API are caught and return `[]`/`None`. Uses `print()` instead of `logger`. | Geocoding silently fails; form submissions may lack coordinates. |
| `services/email_service.py` | (wrapper) | 🟠 High | Email send failures are caught broadly — callers in `events.py` (L1196), `moderation.py` (L244, L287) silently continue. | Users never receive approval/rejection emails and no one is alerted. |
| `api/events.py` | 1135, 1196 | 🟠 High | Recurring instance generation errors are `print()`-ed only (L1135). Email notification errors are logged but swallowed (L1196). | Events created without recurrence instances; email failures invisible. |
| `api/moderation.py` | 244, 287, 366, 371 | 🟠 High | Four separate `except Exception` blocks in the moderation flow. Email, in-app notification, and interest-notification failures are all silently logged. | Admin approves event → organizer never receives *any* notification (email + in-app both silently failed). |
| `api/cron.py` | 161 | 🟡 Medium | Weekly digest queue failure for individual user is caught and logged. Acceptable behaviour (one user's failure shouldn't stop others). | Minor: individual digest failures are invisible. |

**Pattern:** Nearly every `except Exception` in the codebase **logs** the error but **does not re-raise or return a failure indicator**. Callers have no way to know an operation failed.

---

### 2. Transaction Safety

| File | Line(s) | Severity | Issue |
|------|---------|----------|-------|
| `services/recurrence.py` | 173, 177, 180 | 🔴 Critical | Loop calls `session.add(child_event)` for each child. `session.commit()` only happens once after the loop (L177). If the outer `except Exception` (L180) fires mid-loop, **previously added children are in a dirty session with no rollback**. The session is corrupted for the caller. |
| `services/notifications.py` | 41–44 | 🟠 High | `session.commit()` is called inside a helper used by many callers (admin, moderation). If commit fails, the exception is swallowed — but the **caller's own transaction may now be in an invalid state** (SQLAlchemy sessions are not reusable after a failed commit without rollback). |
| `services/payments.py` | 147–151 | 🟡 Medium | `handle_webhook_event` uses `session.query()` + `session.exec()` — mixing SQLModel and SQLAlchemy query APIs. This is fragile; `session.exec(session.query(...))` may not behave as expected across SQLModel versions. |
| `services/payments.py` | 181–187 | 🟡 Medium | Same `session.exec(session.query(...))` pattern in `get_user_payments`. |
| `api/groups.py` | 220–222 | 🟠 High | `join_group` catches exception and does `session.rollback()` — ✅ correct. But the error detail `"Failed to join group"` hides the real cause (could be enum mismatch, constraint violation, etc.). |
| `api/moderation.py` | 445–448 | 🟡 Medium | `resolve_duplicate` does `session.add()` for 3 entities then `session.commit()` — no try/except. If commit fails, the endpoint raises a raw 500 with traceback. |

---

### 3. Hardcoded Secrets

| File | Line | Severity | Issue |
|------|------|----------|-------|
| `api/cron.py` | 24 | 🔴 Critical | `CRON_SECRET = os.getenv("CRON_SECRET", "super-secret-cron-key")` — **hardcoded fallback** means if the env var is missing in production, cron endpoints are protected by a publicly-visible, guessable string. Any attacker can trigger weekly digest blasts or other cron jobs. |

> [!CAUTION]
> All other API keys (`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `CLOUDINARY_API_KEY`, `GOOGLE_GEOCODE_API_KEY`) are loaded from `settings.*` — ✅ no hardcoded secrets.

**Fix:** Remove the default value: `CRON_SECRET = os.getenv("CRON_SECRET")` and add a startup check that raises if `None`.

---

### 4. N+1 Queries & Loop Efficiency

| File | Function | Severity | Issue |
|------|----------|----------|-------|
| `services/postcode_service.py` | `search_os_places` (L66) | 🟠 High | **Serial HTTP → DB round-trips inside a loop.** For each autocomplete result, a separate HTTP GET is made to lookup coordinates. Up to `limit * 2` (20) sequential HTTP calls for one user search. | 
| `api/groups.py` | `list_members` (L259) | 🟠 High | `for member in members: user = session.get(User, member.user_id)` — **classic N+1.** Each member triggers a separate SQL query. Should use `selectinload` or a joined query. |
| `api/admin.py` | `list_event_claims` (L906) | 🟠 High | `for claim in claims: event = session.get(...); user = session.get(...)` — **2N+1 queries.** Each claim triggers two additional lookups. |
| `api/admin.py` | `get_all_featured_bookings` (L1005) | 🟠 High | `for booking in bookings: event = session.get(...); organizer = session.get(...)` — same **2N+1 pattern**. |
| `api/admin.py` | `sync_featured_status` (L1235) | 🟡 Medium | `for booking in active_bookings: event = session.get(...)` — N+1 inside admin sync. Less critical (admin-only, small datasets). |
| `api/cron.py` | `trigger_weekly_digest` (L112) | 🟡 Medium | `for user in subscribed_users:` performs a category-match query per user (L125). Could be batched into one query with user preferences. |

---

### 5. Dead Code & Unreachable Logic

| File | Line(s) | Severity | Issue |
|------|---------|----------|-------|
| `api/events.py` | 1131–1136 | 🟠 High | **Unreachable `elif`:** Line 1120 checks `if new_event.is_recurring:`, and line 1131 checks `elif new_event.is_recurring and new_event.recurrence_rule:` — the `elif` can **never** be reached because the `if` already caught all `is_recurring==True` cases. Dead code with a swallowed `except`. |
| `api/admin.py` | 1354–1364 | 🟠 High | **Orphaned code block:** After the comment "Migration endpoints removed for security" (L1350), there's a free-standing `return { ... }` block referencing `invite.id`, `invite.venue_id`, etc. — **not inside any function.** This is likely a copy-paste remnant. It will cause a `SyntaxError` or be silently ignored depending on Python version/parser behaviour. |
| `api/groups.py` | 31–68 | 🟠 High | **Debug endpoints in production:** `/debug/check-roles` (L31) and `/debug/add-admin-role` (L53) are fully accessible API endpoints that expose internal database enum values and allow **unauthenticated schema modification** (`ALTER TYPE`). These should be removed or gated behind `settings.DEBUG`. |
| `api/moderation.py` | 422–424 | 🟡 Medium | `resolve_duplicate` with `KEEP_ORIGINAL` has a `pass` where organizer notification should go (L424). The comment says "Reuse existing notification logic" but it's a no-op — rejected organizer is never notified. |
| `api/admin.py` | 1461–1490 | 🟡 Medium | `emergency-migrate` endpoint is a raw SQL migration tool with **no auth on the endpoint itself** (only `require_admin` via router prefix). The `except` block returns the error as JSON, potentially leaking internal DB schema details. |

---

### 6. Debug Pollution

Production code contains `print()` statements that should be replaced with proper `logger` calls or removed entirely.

| File | Line(s) | Count |
|------|---------|-------|
| `services/featured.py` | 81, 105–107 | 4 `print()` — `[DEBUG CHECK_AVAILABILITY]` |
| `services/postcode_service.py` | 142, 220 | 2 `print()` — error output |
| `api/groups.py` | 108, 404, 424 | 3 `print()` — invite debug, role debug |
| `api/events.py` | 985, 1136 | 2 `print()` — duplicate detection, recurrence error |
| `api/featured.py` | (various) | ~4 `print()` — checkout debug |
| `services/featured.py` | 257–283 | 6 `print()` — `[CHECKOUT COMPLETED]` debug |

**Total:** ~20 `print()` statements in production code.

---

### Priority Action Plan

#### Immediate (Pre-Alpha / Blocking)
1. **Remove hardcoded CRON fallback secret** in `cron.py` — replace with startup validation.
2. **Remove or gate debug endpoints** `/debug/check-roles` and `/debug/add-admin-role` in `groups.py`.
3. **Add `session.rollback()`** to the `except` block in `recurrence.py` (L180) to prevent corrupted sessions.
4. **Remove orphaned code block** in `admin.py` (L1354–1364).

#### Short-Term (Before Beta)
5. **Fix unreachable `elif`** in `events.py` (L1131) — merge with the `if` branch or remove.
6. **Replace all `print()` with `logger`** across ~20 locations.
7. **Fix N+1 queries** in `groups.py:list_members`, `admin.py:list_event_claims`, and `admin.py:get_all_featured_bookings` using `selectinload` or joined queries.
8. **Fix mixed query API** in `payments.py` — replace `session.exec(session.query(...))` with `session.exec(select(...))`.
9. **Add missing notification** in `moderation.py:resolve_duplicate` for rejected organizer (L424).
10. **Batch postcode lookups** in `postcode_service.py` — use `postcodes.io/postcodes` bulk endpoint.

#### Tech Debt (Planned Sprint)
11. Establish a project-wide error handling pattern: typed exceptions, structured logging, caller-visible failure indicators.
12. Add try/except with `session.rollback()` to all CRUD operations that call `session.commit()`.
13. Gate `emergency-migrate` behind `settings.DEBUG` or remove entirely.
14. Consider adding APM/error tracking (e.g., Sentry) to surface swallowed errors in production.

---

## Phase 3: API & Security

> Scope: All 27 router files in `app/api/`. Audit of authentication, authorization, response models, error handling, status codes, data leaks, and route hygiene.

### 3.1 🔴 Critical — Authentication & Authorization Gaps

#### 3.1.1 Unauthenticated Analytics Endpoints Expose Internal Data

**Files:** `analytics.py` — Lines 571, 618, 665, 712  
**Severity:** 🔴 Critical

Four analytics endpoints have **no authentication** and expose internal platform intelligence to any anonymous caller:

| Endpoint | What it leaks |
|----------|---------------|
| `GET /analytics/supply-gaps` | Areas with low event coverage (competitive intel) |
| `GET /analytics/category-mix` | Category distribution across the platform |
| `GET /analytics/quality-issues` | Events flagged for quality problems |
| `GET /analytics/trending` | Internal trending/popularity signals |

All four should require `get_current_active_admin` or at minimum `get_current_user`.

---

#### 3.1.2 Media Deletion Has No Ownership Check

**File:** `media.py` — Lines 39-61  
**Severity:** 🔴 Critical

`DELETE /media/{folder}/{filename}` requires login but does **not verify ownership**. Any authenticated user can delete any other user's uploaded images by guessing the folder/filename path:

```python
@router.delete("/{folder}/{filename}")
async def delete_media(
    folder: str,
    filename: str,
    current_user: User = Depends(get_current_user)  # Auth only, no ownership check
):
```

**Fix:** Track upload ownership in a `Media` table or verify the file belongs to an entity the user owns.

---

#### 3.1.3 Featured Checkout Session Verification Has No Auth

**File:** `featured.py` — Lines 428-460  
**Severity:** 🔴 Critical

`GET /featured/verify-session/{session_id}` takes a Stripe checkout session ID and returns booking details (including event/venue IDs, user ID, payment intent) with **no authentication**:

```python
@router.get("/verify-session/{session_id}")
def verify_checkout_session(
    session_id: str,
    session: Session = Depends(get_session)  # DB session only, no user auth
):
```

Anyone who knows or guesses a session ID can read payment details. Should require `get_current_user` and verify the session belongs to that user.

---

#### 3.1.4 Email Testing Routes Accessible to Non-Admins

**File:** `email_testing.py` — Lines 94, 133, 159, 187, etc.  
**Severity:** 🔴 Critical

While individual email-send functions check `is_admin`, the admin check is done **inside the function body** rather than as a dependency. The `POST /email-testing/send-test` endpoint (L94) doesn't use `get_current_active_admin` as a dependency — it checks `current_user.is_admin` manually. If the manual check were accidentally removed or bypassed, the endpoint would be open.

**Recommendation:** Use `get_current_active_admin` dependency consistently across all email-testing routes, matching the pattern used in `hero.py`.

---

### 3.2 🟠 High — Data Leaks & Response Model Issues

#### 3.2.1 Raw ORM Models Returned Directly

Several endpoints return raw SQLModel/ORM objects, bypassing Pydantic serialization. This leaks internal fields (timestamps, foreign keys, hashed data, internal IDs).

| File | Endpoint | Line | What leaks |
|------|----------|------|------------|
| `social.py` | `POST /social/follow` | L15 | Returns raw `Follow` object (follower_id, target_id, all timestamps) |
| `recommendations.py` | `GET /recommendations` | L18 | `response_model=List[Event]` — returns the raw SQLModel `Event` table model, not a Pydantic schema |
| `recommendations.py` | `GET /recommendations/events/{id}/similar` | L198 | Same as above — raw `Event` model |
| `organizers.py` | `GET /organizers/{id}` | L94 | Returns raw `Organizer` ORM object via `return organizer` |
| `collections.py` | `GET /collections/seed` | L103 | Returns raw `Collection` ORM objects |

**Fix:** Create proper Pydantic `response_model` schemas for each, exposing only public-safe fields.

---

#### 3.2.2 Missing `response_model` Declarations

These endpoints return dicts/objects without declaring a `response_model`, preventing FastAPI from filtering fields or generating accurate OpenAPI docs:

| File | Endpoint | Line |
|------|----------|------|
| `social.py` | `DELETE /social/unfollow` | L23 |
| `social.py` | `GET /social/following/venues` | L40 |
| `social.py` | `GET /social/following/groups` | L56 |
| `social.py` | `GET /social/{target_type}/{target_id}/followers/count` | L72 |
| `media.py` | `POST /media/upload` | L18 |
| `media.py` | `DELETE /media/{folder}/{filename}` | L39 |
| `admin_import.py` | `POST /admin/events/import-single` | L90 |
| `analytics.py` | Multiple dashboard/stats endpoints | Various |

---

#### 3.2.3 `events.py:get_event` Returns Non-Published Events to Public

**File:** `events.py` — Lines 1203-1232  
**Severity:** 🟠 High

`GET /events/{event_id}` does **no status check** — it returns any event by ID regardless of status (`draft`, `rejected`, `pending`). While the `list_events` endpoint correctly filters by status, the detail endpoint does not:

```python
def get_event(event_id: str, session: Session = Depends(get_session)):
    event = session.get(Event, normalize_uuid(event_id))
    if not event:
        raise HTTPException(...)
    # No status check — returns drafts, rejected, pending to anyone
    return build_event_response(event, session)
```

**Fix:** Add status filtering for non-admin/non-owner users, consistent with `list_events` logic.

---

### 3.3 🟡 Medium — Error Handling & Status Code Issues

#### 3.3.1 `notifications.py:mark_as_read` Returns 200 OK With Failure Payload

**File:** `notifications.py` — Lines 62-79  
**Severity:** 🟡 Medium

When a notification is not found, the endpoint returns `200 OK` with `{"success": false}` instead of raising a `404`:

```python
notification = session.get(Notification, normalize_uuid(notification_id))
if not notification or notification.user_id != current_user.id:
    return {"success": False}  # Should be 404 or 403
```

Clients must parse the response body to detect failure instead of relying on HTTP status codes.

---

#### 3.3.2 `analytics.py:clear_search_history` Double Commit

**File:** `analytics.py` — Lines 349-364  
**Severity:** 🟡 Medium

Calls `session.commit()` twice — once explicitly and once implicitly through the loop:

```python
for event in search_events:
    session.delete(event)
session.commit()       # First commit
# ... more logic ...
session.commit()       # Second commit (redundant, wastes a DB round-trip)
```

---

#### 3.3.3 `events.py:track_ticket_click` No Rate Limiting Against Abuse

**File:** `events.py` — Lines 765-787  
**Severity:** 🟡 Medium

`POST /events/{event_id}/click` is a **public endpoint** (no auth) that increments `ticket_click_count` with no rate limiting or deduplication. An attacker can inflate click counts with a simple script:

```python
@router.post("/{event_id}/click", response_model=EventResponse)
def track_ticket_click(event_id: str, session: Session = Depends(get_session)):
    event.ticket_click_count += 1  # Unbounded increment, no auth
```

---

#### 3.3.4 `events.py:list_events` Duplicate Import Statements

**File:** `events.py` — Lines 26-42  
**Severity:** 🟡 Medium (Code Quality)

Duplicate imports at the top of the file:

```python
from app.schemas.event import (
    EventResponse,       # duplicated on L29 and L31
    EventListResponse,   # duplicated on L30, L32, and L33
    ...
)
from app.schemas.tag import TagResponse  # duplicated on L39, L41, L42
```

Three copies of `EventListResponse` and three copies of `TagResponse` are imported.

---

#### 3.3.5 Unreachable Code Branch in `events.py:create_event`

**File:** `events.py` — Lines 1120-1136  
**Severity:** 🟡 Medium

The `elif` on L1131 is unreachable because L1120 already checks the same condition:

```python
if new_event.is_recurring:          # Line 1120
    generate_recurring_instances(...)
elif new_event.is_recurring and new_event.recurrence_rule:  # Line 1131 — UNREACHABLE
    ...
```

---

#### 3.3.6 `events.py:list_events` Category IDs Filter Silently Dropped

**File:** `events.py` — Lines 402-403  
**Severity:** 🟡 Medium

The `category_ids` parameter is parsed but **never applied** to the query — the `where` clause is missing:

```python
if category_ids and not category and not category_id:
    cat_id_list = [normalize_uuid(cid.strip()) for cid in category_ids.split(",")]
    # BUG: Missing query.where(Event.category_id.in_(cat_id_list))
```

---

### 3.4 🔵 Low — Code Quality & Hygiene

#### 3.4.1 Debug `print()` Statements in API Layer (Additional)

Phase 2 identified ~20 `print()` statements. Phase 3 found additional occurrences in the API layer:

| File | Line(s) | Content |
|------|---------|---------|
| `events.py` | L305 | `print(f"[EVENTS_DEBUG] Filtering by category slug...")` |
| `events.py` | L430, L531 | `print(f"DEBUG: City Filter Active...")`, `print(f"DEBUG: Returned {len(results)}...")` |
| `bookmarks.py` | L40, L47 | `print(f"Event {event_id} data: ...")`, `print(f"Checking category: ...")` |
| `featured.py` | ~15 occurrences | `print(f"[CHECKOUT]...")`, `[WEBHOOK]` debug across checkout/webhook flows |
| `analytics.py` | L357 | Debug print in search history clear |

---

#### 3.4.2 Inconsistent Auth Dependency Injection

The codebase uses three different import paths for the same auth dependencies:

| Pattern | Used in |
|---------|---------|
| `from app.core.security import get_current_user` | Most files (correct) |
| `from app.api.auth import get_current_user` | `notifications.py` (L14) |
| `from app.core.security import get_current_active_admin` | `hero.py` only |

**Risk:** If `app.api.auth` re-exports a different version or becomes stale, `notifications.py` may use a mismatched dependency.

---

#### 3.4.3 `venues.py:list_venue_staff` N+1 Query

**File:** `venues.py` — Lines 954-955  
**Severity:** 🔵 Low (Performance)

Iterates over staff members and loads each `User` individually:

```python
for member in staff_members:
    user = session.get(User, member.user_id)  # N+1 query per staff member
```

**Fix:** Use a single joined query or `selectinload`.

---

#### 3.4.4 `events.py:update_event` Double Query for Participating Venues

**File:** `events.py` — Lines 1561-1566  
**Severity:** 🔵 Low (Waste)

The same `select(EventParticipatingVenue)` query is executed twice — once on L1561-1563 (result discarded) and again on L1564-1566:

```python
session.exec(
    select(EventParticipatingVenue).where(EventParticipatingVenue.event_id == event.id)
)  # Result discarded
existing_links = session.exec(
    select(EventParticipatingVenue).where(EventParticipatingVenue.event_id == event.id)
).all()  # Same query again
```

---

### Phase 3 Priority Action Plan

#### Immediate (Pre-Alpha / Blocking)
1. **Add auth to analytics endpoints** — `supply-gaps`, `category-mix`, `quality-issues`, `trending` must require `get_current_active_admin`.
2. **Add ownership check to `media.py:delete_media`** — verify the file belongs to an entity the user owns before deleting.
3. **Add auth to `featured.py:verify-session`** — require `get_current_user` and verify session ownership.
4. **Add status filter to `events.py:get_event`** — non-admin/non-owner users should only see published events.

#### Short-Term (Before Beta)
5. **Replace raw ORM returns** in `social.py:follow`, `recommendations.py`, `organizers.py:get_organizer` with proper Pydantic response schemas.
6. **Fix `notifications.py:mark_as_read`** — return 404/403 instead of 200 with `{success: false}`.
7. **Add rate limiting to `events.py:track_ticket_click`** — apply `@limiter.limit()` decorator.
8. **Fix silent category_ids filter drop** in `events.py` L402-403 — add the missing `.where()` clause.
9. **Remove unreachable `elif`** in `events.py` L1131.
10. **Add `response_model`** to all endpoints listed in §3.2.2.

#### Tech Debt (Planned Sprint)
11. Standardize auth import path to `app.core.security` across all files.
12. Remove all `print()` debug statements from the API layer (~25 additional occurrences).
13. Fix double queries in `events.py:update_event` (L1561-1566) and double commit in `analytics.py`.
14. Use `get_current_active_admin` dependency (not manual `is_admin` check) for `email_testing.py` routes.

---

## Phase 4: Config & Cleanup

> Scope: `app/core/`, `app/main.py`, root files (`Dockerfile`, `start.sh`, `emergency.py`, `.env.example`). Audit of CORS, unused config, circular imports, middleware, startup hygiene, and auth internals.

### 4.1 Configuration Issues

| File | Variable/Setting | Severity | Issue | Recommended Fix |
|------|------------------|----------|-------|-----------------|
| `.env.example` | `CORS_ORIGINS` | 🔴 Critical | `.env.example` uses `CORS_ORIGINS` but `config.py` expects `ALLOWED_ORIGINS` — any developer copying the example will have **no CORS origins set**, causing all cross-origin requests to fail silently | Rename to `ALLOWED_ORIGINS` in `.env.example` |
| `.env.example` | `MAPBOX_API_KEY` | 🟡 Medium | Listed in `.env.example` but **not defined** in `config.py` — the app actually uses Google Maps (`GOOGLE_MAPS_API_KEY`) and OS Places. Dead reference from an abandoned Mapbox integration | Remove `MAPBOX_API_KEY` from `.env.example` |
| `config.py` | `ALLOWED_ORIGINS` default | 🟡 Medium | Default is `[]` (empty list). If the env var is not set, **no CORS origins are allowed** — the API will silently reject all browser requests. No startup warning is emitted | Add a startup log warning when `ALLOWED_ORIGINS` is empty |
| `main.py` | `allow_methods=["*"]` | 🔵 Low | Allows all HTTP methods including `PATCH`, `OPTIONS`, `TRACE`. Not dangerous but overly permissive | Restrict to `["GET", "POST", "PUT", "DELETE", "OPTIONS"]` |

---

### 4.2 Unused Config Variables

These variables are defined in `config.py` but **never referenced** anywhere in the application code:

| Variable | Line | Notes |
|----------|------|-------|
| `APP_NAME` | L15 | Not used in `main.py` (which hardcodes `"Highland Events Hub API"`) |
| `APP_VERSION` | L16 | Not used in `main.py` (which hardcodes `"1.0.0"`) |
| `DATABASE_URL_POOLER` | L23 | Defined for Render pooled connections but never passed to `create_engine` |
| `GOOGLE_MAPS_API_KEY` | L70 | Vestige — the app uses `GOOGLE_GEOCODE_API_KEY` for postcode lookups instead |
| `OS_PLACES_API_KEY` | L79 | Defined but `settings.OS_PLACES_API_KEY` is never accessed; `postcode_service.py` uses `OS_API_KEY` directly via `os.getenv()`, bypassing settings entirely |
| `OS_API_KEY` | L80 | Defined in config but `postcode_service.py` reads it via `os.getenv("OS_API_KEY")` instead of `settings.OS_API_KEY` |
| `CHECKIN_MAX_DISTANCE_METERS` | L93 | No check-in feature exists — leftover from planned feature |
| `CHECKIN_TIME_BUFFER_MINUTES` | L94 | Same — leftover from planned feature |

**Total: 8 dead config variables** (30% of non-service configs).

---

### 4.3 🔴 Critical — `security.py:get_current_user` Returns Incomplete User

**File:** `security.py` — Lines 121-137  
**Severity:** 🔴 Critical

`get_current_user` bypasses SQLModel and uses a **hardcoded raw SQL SELECT** that only fetches 7 of 15+ User columns:

```python
statement = sql_text(
    "SELECT id, email, password_hash, username, trust_level, is_admin, created_at "
    "FROM users WHERE id = :user_id"
)
user = User(
    id=row[0], email=row[1], password_hash=row[2], username=row[3],
    trust_level=row[4], is_admin=bool(row[5]), created_at=row[6]
)
```

**Missing fields:** `is_trusted_organizer`, `display_name`, `is_active`, `avatar_url`, `bio`, `phone`, `location`, `website`.

**Impact:**
- `is_trusted_organizer` defaults to `False` → **trusted organizers lose auto-approval** for events, promotions, and venue claims.
- `is_active` is not loaded → **banned users can still authenticate** (the `is_active` check can't work).
- `display_name` defaults to `None` → notification emails show `None` instead of the user's name.

The same issue exists in `get_current_user_optional` (L162-180).

**Fix:** Replace raw SQL with `session.get(User, user_id_normalized)` or add all critical columns to the SELECT.

---

### 4.4 🟠 High — Inline SQL Migrations in `main.py`

**File:** `main.py` — Lines 75-170 (95 lines)  
**Severity:** 🟠 High

The lifespan function contains **~95 lines of inline `ALTER TABLE` SQL** that executes on every startup, including:

- 12 individual `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements
- A `FOR` loop that inserts hero slot seed data
- A `UPDATE events SET created_at = ...` backfill query

**Problems:**
1. **Runs on every cold start** — the `ADD COLUMN IF NOT EXISTS` calls are idempotent on Postgres but waste startup time.
2. **Not version-tracked** — no way to know which migrations have run or roll them back.
3. **Hero slot seed data** is inserted on every boot (the `IF NOT result` check prevents duplicates, but it's still checking on every start).
4. **The backfill UPDATE** runs on every boot and modifies data in-place.

**Note:** `database.py:run_migrations` (called on L72) has a separate hardcoded migration that sets `banned@test.com` to `is_active=FALSE` on every startup. This is test data in production migration code.

**Fix:** Move all inline migrations to timestamped Alembic migration files. Remove the `banned@test.com` hardcoded update.

---

### 4.5 🟠 High — `notifications.router` Mounted Without Prefix

**File:** `main.py` — Line 276  
**Severity:** 🟠 High

```python
app.include_router(notifications.router)  # No prefix!
```

Every other router has an explicit `/api/...` prefix. `notifications.router` is mounted at the root, meaning its routes register at whatever path the router defines internally. If the router uses `""` as its base path, notification endpoints may conflict with the SPA catch-all or other routes.

Compare with the consistent pattern:
```python
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(notifications.router)  # ← No prefix, no tags
```

---

### 4.6 🟡 Medium — Startup `print()` Clutter

**File:** `main.py` — Lines 15, 21, 39, 45, 49, 52-53, 67, 71, 174, 179, 189  
**Severity:** 🟡 Medium

11 `print()` statements in the startup path, all prefixed with `--- [STARTUP]` or `--- [LIFESPAN]`. These were debug aids during deployment and should be converted to `logger.info()` or removed:

```python
print("--- [STARTUP] Loading modules... ---")             # L15
print(f"--- [STARTUP] DATABASE_URL detected: {safe_url} ---")  # L21
print("--- [LIFESPAN] Starting lifespan manager... ---")  # L39
# ... 8 more
```

---

### 4.7 🟡 Medium — `static_dir` Used Before Definition

**File:** `main.py` — Lines 239, 242  
**Severity:** 🟡 Medium

The `root()` route handler references `static_dir` on L239, but `static_dir` is defined on L242:

```python
@app.get("/", tags=["Initial Load"])
async def root(request: Request):
    return FileResponse(os.path.join(static_dir, "index.html"))  # L239 — uses static_dir

static_dir = "static"  # L242 — defined AFTER usage
```

This works at runtime because `root()` is only called when a request arrives (by which time L242 has executed), but it's fragile and confusing. If the route were called during initialization, it would raise a `NameError`.

---

### 4.8 🟡 Medium — `emergency.py` Left in Repo Root

**File:** `backend/emergency.py`  
**Severity:** 🟡 Medium

A standalone 8-line FastAPI maintenance page app exists in the repo root:

```python
app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "We are undergoing maintenance. Back shortly!"}
```

This is presumably a manual failover used during deployment issues. It should be documented or moved to an ops/scripts directory, not left in the repo root where it could be accidentally deployed.

---

### 4.9 🔵 Low — Miscellaneous

| File | Issue | Severity |
|------|-------|----------|
| `main.py` L12 | `from sqlmodel import SQLModel` is imported but only used inside the `lifespan` function — could be a local import | 🔵 Low |
| `main.py` L184 | Empty `pass` at end of lifespan shutdown — no cleanup logic exists | 🔵 Low |
| `api/__init__.py` | Contains only `# To be completed by Claude Code.` — stale placeholder comment | 🔵 Low |
| `config.py` L6 | `from typing import Optional, Union` — `Optional` is not used directly (handled by `Optional[str]` syntax) | 🔵 Low |
| `database.py` L20-21 | Comments describe `pool_size=20` as "High Performance Mode" but this is the default SQLAlchemy pool size — misleading | 🔵 Low |

---

### 4.10 Circular Import / `__init__.py` Assessment

**No circular import issues found.** The `__init__.py` files follow a clean pattern:

- `models/__init__.py` — Imports all models with `__all__` export list. Clean.
- `schemas/__init__.py` — Imports all schemas with `__all__` list. Clean.
- `api/__init__.py` — Empty stub. No import logic.
- `core/` — Has no `__init__.py` at all (relies on direct imports). No risk.

`security.py` uses delayed imports (`from app.models.user import User` inside function body) to correctly break the circular dependency between `core.security` ↔ `models.user`. This is the right pattern.

---

### Phase 4 Priority Action Plan

| Priority | # | Action | File |
|----------|---|--------|------|
| 🔴 Immediate | 1 | **Fix `get_current_user` raw SQL** — add `is_trusted_organizer`, `is_active`, `display_name` columns (or switch to `session.get(User, id)`) | `security.py` |
| 🔴 Immediate | 2 | **Fix `.env.example` CORS key** — rename `CORS_ORIGINS` to `ALLOWED_ORIGINS` | `.env.example` |
| 🟠 Short-Term | 3 | **Add prefix to `notifications.router`** — use `/api/notifications` | `main.py` |
| 🟠 Short-Term | 4 | **Move inline migrations** to Alembic or a standalone migration script | `main.py` |
| 🟠 Short-Term | 5 | **Remove `banned@test.com`** hardcoded update from `database.py:run_migrations` | `database.py` |
| 🟡 Medium-Term | 6 | **Remove 8 unused config variables** listed in §4.2 | `config.py` |
| 🟡 Medium-Term | 7 | **Wire `APP_NAME`/`APP_VERSION`** into `FastAPI()` constructor instead of hardcoding | `main.py`, `config.py` |
| 🟡 Medium-Term | 8 | **Replace 11 startup `print()`** with `logger.info()` | `main.py` |
| 🟡 Medium-Term | 9 | **Fix `static_dir` ordering** — define before the route that uses it | `main.py` |
| 🔵 Tech Debt | 10 | Move `emergency.py` to `scripts/` or document its purpose | `emergency.py` |
| 🔵 Tech Debt | 11 | Remove `MAPBOX_API_KEY` from `.env.example` | `.env.example` |
| 🔵 Tech Debt | 12 | Fix `postcode_service.py` to read `OS_API_KEY` from `settings` instead of `os.getenv()` | `postcode_service.py` |
