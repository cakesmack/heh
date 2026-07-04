# Highland Events Hub — Master Context File

> **Purpose:** Inviolable reference for all AI agents working on this codebase. Scan before writing any code.  
> **Stack:** Next.js (Pages Router) + FastAPI + PostgreSQL (SQLModel/SQLAlchemy) + Alembic + Google Maps API  
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
* ORM & Database: SQLModel / SQLAlchemy
* Database Migrations: Alembic (`backend/alembic/`)

**Database & Environment:**
* Primary Database: PostgreSQL (Strictly NO SQLite syntax)
* Production Hosting: Render (Automated pre-deploy migrations via `alembic upgrade head`)

---

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
| **Default Category** | `Uncategorized` (`uncategorized`) |

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
| `city` | `str(100)` | indexed (`ix_venues_city`), town/city location |
| `status` | `VenueStatus` enum | `VERIFIED` · `UNVERIFIED` · `ARCHIVED` (indexed `ix_venues_status`) |
| `latitude` / `longitude` | `float` | indexed, required |
| `geohash` | `str(12)` | indexed |
| `slug` | `str(300)` | indexed, for SEO URLs |
| `seo_title` | `str(120)` | optional override |
| `seo_description` | `str(500)` | optional override |
| `description` | `Text` | long-form overview for SEO & public profile |
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

### `organizers` (Groups)

| Aspect | Detail |
|---|---|
| **PK** | `id` · `str` (UUID, hex, no dashes) |

**Core Columns**

| Column | Type | Notes |
|---|---|---|
| `name` | `str(255)` | required, indexed |
| `slug` | `str(255)` | unique, indexed |
| `description` | `Text` | long-form overview rendered above event feeds |
| `group_type` | `str(50)` | e.g. Community, Commercial, Charity |
| `category_focus` | `str(50)` | main event type |
| `city` / `postcode` | `str` | location |
| `logo_url` / `banner_url` | `str` | media |
| `is_verified` | `bool` | verification badge |

---

### `collections`

| Aspect | Detail |
|---|---|
| **PK** | `id` · `int` (auto-increment) |

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
| `filter_params` | `JSONB` | structured filter definition: category, tags, `filter_mode` (`AND` / `OR`), `exclude_age_restrictions` (`bool`), `exclude_event_ids` (`str[]`) |

---

### Database Migration Protocol (Alembic)

> [!IMPORTANT]
> **Inviolable Rule**: Never alter a database model without explicitly generating the corresponding Alembic migration command (`alembic revision --autogenerate -m "..."`).

- **Migration Scripts**: Located in `backend/alembic/versions/`.
- **Deployment Automation**: Pre-deployment scripts (`start.sh` and `release.sh`) run `alembic upgrade head` automatically prior to application server boot.

---

## 3. Routing & SEO Rules

### Dual-Resolution URL Pattern (Event + Venue + Group)

`GET /api/events/{id}`, `GET /api/venues/{id}`, and `GET /api/organizers/{id}` accept **either a slug or a UUID** in the same path parameter. The backend resolves in this order:

1. **Try slug lookup** → `WHERE slug = :param`
2. **Fall back to UUID** → `WHERE id = :param`
3. **404** if neither matches.

### SSR 301 Redirect Enforcement

> [!CAUTION]
> **Detail Pages** (`events/[id].tsx`, `venues/[id].tsx`, `groups/[slug].tsx`) implement `getServerSideProps` with canonical redirect logic. Any new detail page **must** replicate this pattern.

**Rule:** If the entity has a canonical `slug` and the URL param `id ≠ slug`, issue an **HTTP 301 Permanent Redirect** to the slug URL. Query parameters (UTM, ticket refs, etc.) are preserved through the redirect.

### Static & Dynamic Metadata Architecture

1. **Main Groups Index (`/groups/`)**:
   - **Title**: `Local Event Organizers, Clubs & Promoters in the Highlands`
   - **Description**: `Browse the complete directory of event organizers, community groups, and local promoters across Inverness and the Scottish Highlands. Find out who is hosting what.`

2. **Group Profile (`/groups/[slug]`)**:
   - **Dynamic Meta Title**: `[Group Name] Events, Dates & [Current Year] Schedule`

3. **Main Venues Index (`/venues/`)**:
   - **Title**: `Event Venues, Halls & Theatres in the Highlands`
   - **Description**: `Browse the complete directory of event venues, community halls, pubs, and theatres across Inverness and the Scottish Highlands. See what is happening near you.`

4. **Venue Profile (`/venues/[slug]`)**:
   - **Dynamic Meta Title**: `[Venue Name] Contact Details, Location & Venue Hire | [Town/City]`
   - **Dynamic Meta Description**: `Find contact details, address, photographs, and booking information for [Venue Name] in [Town/City]. View the complete Highland venue directory.`

### Programmatic Location Timeframe Sub-Routes (`/locations/{slug}/{timeframe?}`)

Nested sub-routes for all core locations (Inverness, Aviemore, Fort William, Oban, Elgin, Nairn, Thurso, Portree):
- **Base Route (`/locations/{slug}`)**: All upcoming events from current server time forward.
  - *Title*: `Events & Things to Do in [Location] | Highland Events Hub`
  - *Description*: `Find out what's on in [Location], Scottish Highlands. Live music, festivals, community events, and things to do.`
  - *H1 Heading*: `Events & Things to Do in [Location]`
- **Today Route (`/locations/{slug}/today`)**: Filtered strictly to current calendar day window (00:00:00 to 23:59:59 UTC/server time).
  - *Title*: `What's On in [Location] Today | Gigs & Events Guide`
  - *Description*: `Discover live music, theater, and things to do in [Location] today. View today's full schedule of local events.`
  - *H1 Heading*: `What's On in [Location] Today`
- **This Weekend Route (`/locations/{slug}/this-weekend`)**: Filtered strictly to Friday 16:00:00 through Sunday 23:59:59 window.
  - *Title*: `What's On in [Location] This Weekend | Local Events & Gigs`
  - *Description*: `Looking for things to do in [Location] this weekend? View the full calendar of weekend gigs, family activities, and local events.`
  - *H1 Heading*: `What's On in [Location] This Weekend`

**Thin Content / Empty State Fallback Protection**:
- If a time-specific query (`today` or `this-weekend`) yields 0 events, backend intercepts before returning, sets `is_fallback = true`, returns the next 5 upcoming chronologically available events for that location, and includes `fallback_notice` string for frontend notice banner rendering.

**Crawlable Navigation Tabs & Sitemap**:
- Explicit HTML `<a>` links directly above event listing grid linking to base, `/today`, and `/this-weekend`.
- Dynamic Sitemap Generator (`sitemap.xml.ts`) automatically generates all 3 URLs for each core location.

### Zero-Event State Rule for Venue Profiles

- If a venue has **0 upcoming events**, completely hide the "Upcoming Events" UI section, calendar grid, and "0 Results" counter.
- Do **NOT** render a "No upcoming events scheduled" empty state box.
- Render the page purely as a static directory listing using header image, description, map, amenities, and contact details.

---

## 4. Admin UI & Form Unification (DRY Principle)

- **Single Shared Form Component**: All venue edit/verify actions across the admin panel (Admin Venues Table, Rising Locations Widget, Geographic Hubs, Venue Detail Page) must use the single shared `EditVenueModal` component (`frontend/src/components/venues/EditVenueModal.tsx`).
- Simplified ad-hoc edit modals are deprecated to prevent form parameter divergence.

---

## 5. Core Component Constraints

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
