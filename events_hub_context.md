# Highland Events Hub — Master Context File

> **Purpose:** Inviolable reference for all AI agents working on this codebase. Scan before writing any code.
> **Stack:** Next.js (Pages Router) + FastAPI + PostgreSQL (SQLModel/SQLAlchemy) + Google Maps API
> **Domain:** `https://www.highlandeventshub.co.uk`

---
## 1. Tech Stack & Infrastructure

**Frontend:**
* Framework: Next.js (Strictly Pages Router, e.g., `src/pages/`)
* Language: TypeScript
* UI/Styling: React, Tailwind CSS

**Backend:**
* Framework: FastAPI (Python)
* Data Validation/Schemas: Pydantic
* ORM: SQLAlchemy / SQLModel

**Database & Environment:**
* Primary Database: PostgreSQL (Strictly NO SQLite syntax)
* Production Hosting: Render

## 2. Database Architecture (Source of Truth)

> [!NOTE]
> Extracted from SQLAlchemy/SQLModel definitions in `backend/app/models/`. Boilerplate columns (`created_at`, `updated_at`) and auth/migration tables omitted.

---

### `events`

| Aspect | Detail |
|---|---|
| **PK** | `id` · `str` (UUID, hex, no dashes) |
| **Unique Constraint** | `(title, date_start, venue_id)` |

**Foreign Keys**

| Column | Target | On Delete |
|---|---|---|
| `venue_id` | `venues.id` | SET NULL |
| `category_id` | `categories.id` | SET NULL |
| `organizer_id` (submitting user) | `users.id` | SET NULL |
| `organizer_profile_id` (group) | `organizers.id` | SET NULL |

**Core Columns**

| Column | Type | Notes |
|---|---|---|
| `title` | `str(255)` | indexed |
| `description` | `str(20000)` | |
| `slug` | `str(300)` | indexed, for SEO URLs |
| `seo_title` | `str(120)` | optional override |
| `seo_description` | `str(500)` | optional override |
| `date_start` / `date_end` | `datetime` | indexed |
| `is_all_day` | `bool` | |
| `latitude` / `longitude` | `float` | indexed |
| `geohash` | `str(12)` | indexed, spatial lookup |
| `location_name` | `str(255)` | fallback when no venue |
| `map_display_lat` / `map_display_lng` | `float` | custom pin for multi-venue |
| `map_display_label` | `str(255)` | |
| `price` | `float` | legacy, kept for compat |
| `price_display` | `str(100)` | user-facing price text |
| `min_price` | `float` | parsed for search filters |
| `featured` | `bool` | indexed |
| `featured_until` | `datetime` | |
| `status` | `str` | `published` · `pending` · `rejected` · `draft` |
| `moderation_reason` | `str(255)` | |
| `is_recurring` | `bool` | indexed |
| `recurrence_rule` | `str(500)` | RRULE string |
| `parent_event_id` | `str` | UUID of parent series |
| `recurrence_group_id` | `str` | shared across series |
| `view_count` / `attending_count` / `ticket_click_count` | `int` | denormalised analytics |
| `image_url` | `str(500)` | |
| `ticket_url` / `website_url` | `str(500)` | |
| `age_restriction` | `str(50)` | legacy |
| `min_age` | `int` | 0 = all ages, NULL = unset |
| `postcode` | `str(10)` | |
| `address_full` | `str(500)` | |

**ORM Relationships**

- `venue` → `Venue` (many-to-one)
- `participating_venues` → `Venue[]` (many-to-many via `event_participating_venues`)
- `organizer` → `User` (many-to-one)
- `organizer_profile` → `Organizer` (many-to-one)
- `category_rel` → `Category` (many-to-one)
- `tags` → `Tag[]` (many-to-many via `event_tags`)
- `bookmarks` → `Bookmark[]`
- `showtimes` → `EventShowtime[]` (cascade delete-orphan)

---

### `venues`

| Aspect | Detail |
|---|---|
| **PK** | `id` · `str` (UUID, hex, no dashes) |

**Foreign Keys**

| Column | Target | On Delete |
|---|---|---|
| `category_id` | `venue_categories.id` | — |
| `owner_id` | `users.id` | SET NULL |

**Core Columns**

| Column | Type | Notes |
|---|---|---|
| `name` | `str(255)` | indexed |
| `address` | `str(500)` | required |
| `status` | `VenueStatus` enum | `VERIFIED` · `UNVERIFIED` · `ARCHIVED` |
| `latitude` / `longitude` | `float` | indexed, required |
| `geohash` | `str(12)` | indexed |
| `slug` | `str(300)` | indexed, for SEO URLs |
| `seo_title` | `str(120)` | optional override |
| `seo_description` | `str(500)` | optional override |
| `description` | `str(2000)` | |
| `website` / `website_url` | `str(255)` | |
| `phone` / `email` | `str` | |
| `opening_hours` | `str(500)` | |
| `image_url` | `str(500)` | |
| `formatted_address` | `str(500)` | display-ready |
| `postcode` | `str(10)` | indexed |
| `address_full` | `str(500)` | |
| `google_place_id` | `str(255)` | unique, indexed |
| `is_dog_friendly` / `has_wheelchair_access` / `has_parking` / `serves_food` | `bool` | amenity flags |
| `amenities_notes` | `str(500)` | |
| `is_dismissed` | `bool` | hidden from rising lists |
| `social_facebook` / `social_instagram` / `social_x` / `social_linkedin` / `social_tiktok` | `str(255)` | |

**ORM Relationships**

- `owner` → `User` (many-to-one)
- `category_rel` → `VenueCategory` (many-to-one)
- `events` → `Event[]` (one-to-many, primary venue)
- `participating_in_events` → `Event[]` (many-to-many via `event_participating_venues`)
- `promotions` → `Promotion[]`
- `staff` → `VenueStaff[]`

---

### `collections`

| Aspect | Detail |
|---|---|
| **PK** | `id` · `int` (auto-increment) |

> [!IMPORTANT]
> `display_mode` column does **not** exist yet. It was mentioned in early planning but has not been added to the model.

**Core Columns**

| Column | Type | Notes |
|---|---|---|
| `title` | `str` | indexed |
| `subtitle` | `str` | |
| `image_url` | `str` | |
| `target_link` | `str` | required, the URL the card links to |
| `is_active` | `bool` | |
| `sort_order` | `int` | |
| `fixed_start_date` / `fixed_end_date` | `date` | overrides dynamic date filters |
| `slug` | `str` | unique |
| `description` | `Text` | long-form |
| `filter_params` | `JSONB` | structured filter definition |

**ORM Relationships** — None (standalone entity, no FK to other core tables).

---

### `event_participating_venues` (Link Table)

| Column | Type | Notes |
|---|---|---|
| `event_id` | `str` FK → `events.id` | **composite PK** |
| `venue_id` | `str` FK → `venues.id` | **composite PK** |

Enables many-to-many between Events and Venues for multi-venue events (festivals, crawls).

---

### `event_showtimes` (Child Table)

| Column | Type | Notes |
|---|---|---|
| `id` | `int` | auto-increment PK |
| `event_id` | `str` FK → `events.id` | CASCADE delete, indexed |
| `start_time` | `datetime` | indexed |
| `end_time` | `datetime` | optional |
| `ticket_url` | `str(500)` | per-showtime tickets |
| `notes` | `str(255)` | e.g. "Matinee", "Evening" |

---

### Entity Relationship Summary

```
Collection (standalone — no FK joins)

Event ──┬── belongs to ──→ Venue         (via venue_id, SET NULL)
        ├── belongs to ──→ Category      (via category_id, SET NULL)
        ├── submitted by → User          (via organizer_id, SET NULL)
        ├── profiled by ─→ Organizer     (via organizer_profile_id, SET NULL)
        ├── M:M ─────────→ Venue[]       (via event_participating_venues)
        ├── M:M ─────────→ Tag[]         (via event_tags)
        └── has many ────→ EventShowtime (cascade delete)

Venue ──┬── owned by ────→ User          (via owner_id, SET NULL)
        └── belongs to ──→ VenueCategory (via category_id)
```

---

## 3. Routing & SEO Rules

### Dual-Resolution URL Pattern (Event + Venue)

Both `GET /api/events/{id}` and `GET /api/venues/{id}` accept **either a slug or a UUID** in the same path parameter. The backend resolves in this order:

1. **Try slug lookup** → `WHERE slug = :param`
2. **Fall back to UUID** → `WHERE id = :param`
3. **404** if neither matches.

This means `/events/highland-ceilidh-jun-2026` and `/events/a1b2c3d4e5f6...` both resolve to the same resource.

### SSR 301 Redirect Enforcement

> [!CAUTION]
> **Both** `events/[id].tsx` and `venues/[id].tsx` implement `getServerSideProps` with identical redirect logic. Any new detail page **must** replicate this pattern.

**Rule:** If the entity has a canonical `slug` and the URL param `id ≠ slug`, issue an **HTTP 301 Permanent Redirect** to the slug URL. Query parameters (UTM, ticket refs, etc.) are preserved through the redirect.

```
Request:  /events/a1b2c3d4e5f6
API:      returns event with slug = "highland-ceilidh-jun-2026"
Response: 301 → /events/highland-ceilidh-jun-2026
```

If no slug exists on the entity, the UUID URL is served directly — **no redirect**.

### Canonical URL Construction

```
canonical = {siteUrl}/{entityType}/{entity.slug || entity.id}
```

- Always emitted via `<link rel="canonical">` in `<Head>`.
- Always used as `og:url`.
- Query parameters are **stripped** from the canonical (the redirect preserves them for the browser, but the canonical is always clean).
- `siteUrl` = `NEXT_PUBLIC_BASE_URL` or `https://www.highlandeventshub.co.uk`.

### JSON-LD Structured Data

| Page | Schema Type | Required Fields |
|---|---|---|
| Event Detail | `schema.org/Event` | `name`, `startDate`, `endDate`, `eventStatus`, `location` (Place → PostalAddress + GeoCoordinates), `image`, `offers` (price, currency, availability), `organizer` |
| Venue Detail | `schema.org/Place` | `name`, `description`, `address` (PostalAddress), `geo` (GeoCoordinates), `telephone`, `url` |

> [!IMPORTANT]
> Every new public-facing page **must** include: `<link rel="canonical">`, `og:*` meta tags, `twitter:*` meta tags, and a relevant JSON-LD `<script type="application/ld+json">` block.

### SEO Title/Description Priority

Both Event and Venue pages follow the same cascade:

1. **Manual override** → `seo_title` / `seo_description` (from DB)
2. **Template fallback** → high-CTR template interpolating title, venue/city, date

---

## 4. Core Component Constraints

### The Map (`pages/map.tsx`)

> [!CAUTION]
> **The Map is a date-range component, not a single-day view.** Agents must **never** assume or implement single-day filtering logic when working with the Map page or its child components.

**Architecture:**

| File | Role |
|---|---|
| `pages/map.tsx` | Page shell: state management, data fetching, layout |
| `components/map/MapDateFilter.tsx` | Date-range pill selector + custom range picker |
| `components/map/MapSidebar.tsx` | Desktop event list panel |
| `components/map/MapEventCard.tsx` | Mobile marker-tap card |
| `components/events/GoogleMapView.tsx` | Google Maps renderer (dynamically imported, SSR disabled) |
| `components/events/ClusteredEventMarkers.tsx` | Marker clustering logic |

**Temporal Constraint — How It Actually Works:**

- **Default on load:** `today → endOfDay(today + 7)` = **"Next 7 Days"** (`selectedRangeId = 'week'`).
- **Preset pills:** `This Weekend` · `Next 7 Days` · `Next 30 Days`.
- **Custom range:** User selects arbitrary `from → to` via a `react-day-picker` range modal.
- **Data fetch:** `date_from` and `date_to` ISO strings are sent to `eventsAPI.listMap()`. The component **re-fetches on every range change**.
- **Category filter:** Applied **client-side** after the date-filtered fetch.

**Strict Rules for Map Work:**

1. **Never reduce to single-day.** The date state is always `{ start: Date, end: Date }`, never a single date.
2. **Never remove the default 7-day window.** If you reset filters, default back to `week`, not "today only".
3. **The map dynamically imports `GoogleMapView`** with `ssr: false`. Do not attempt to server-render it.
4. **Coordinate safety:** All events are filtered for valid `latitude`/`longitude` before being passed to the map to prevent render crashes.
5. **Mobile vs Desktop divergence:** Mobile shows a bottom-card modal on marker tap; Desktop scrolls the sidebar list. Both paths must be maintained.
