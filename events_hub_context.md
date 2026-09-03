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
* Connection Pooling: SQLAlchemy engine must enforce Render stability parameters (`pool_pre_ping=True`, `pool_size=50`, `max_overflow=50`, `pool_recycle=1800`) to prevent dropped SSL connections and handle traffic spikes.

**Backend Dependency Management:**
* Explicitly banned dependencies: `beautifulsoup4` or any unstructured scraping logic. Core backend ingestion scripts must remain isolated or rely strictly on established, typed APIs.

**Frontend Security (XSS Prevention):**
* Any component rendering raw HTML (e.g., `RichText.tsx`) must strictly sanitize content using `isomorphic-dompurify` via `DOMPurify.sanitize(content)` before passing it to `dangerouslySetInnerHTML`.

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
| `status` | `str(50)` | explicit string mapping (`VERIFIED` · `UNVERIFIED` · `ARCHIVED`), indexed `ix_venues_status` |
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

### Custom Error Pages (Next.js)

**Rule:** The Next.js `pages/` directory must strictly implement and maintain custom `404.tsx` and `500.tsx` pages styled with Tailwind CSS to match the platform's visual identity. Falling back to the default unstyled Next.js error boundaries is prohibited.

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

5. **Event Detail Page (`/events/[id]` or `/events/[slug]`)**:
   - **Dynamic Meta Title**: `[Event Name] Tickets, Dates & Info | [Venue Name]` (Fallback if venue missing/unverified pin: `[Event Name] Tickets, Dates & Info | [City/Town]`). Strictly truncated to **<= 60 characters**.
   - **Dynamic Meta Description**: `Get dates, times, and event information for [Event Name] at [Venue Name] in [City]. Check the full schedule and plan your visit.` (Fallback if venue missing: `Get dates, times, and event information for [Event Name] in [City]. Check the full schedule and plan your visit.`). Strictly truncated to **<= 160 characters**.

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

### Schema.org/Event JSON-LD Structured Data

Implemented on all Event Detail pages (`frontend/src/pages/events/[id].tsx`):
- **`@type`**: `"Event"`
- **`startDate`**: ISO 8601 string (`event.date_start`).
- **`endDate`**: ISO 8601 string (`event.date_end`). If `date_end` is missing or invalid, programmatically defaults to **`startDate + 2 hours`**.
- **`location`**: `@type`: `"Place"` with nested `@type`: `"PostalAddress"` (`streetAddress`, `addressLocality`, `addressRegion`: `"Highlands"`, `postalCode`, `addressCountry`: `"GB"`) and optional `geo` coordinates.
- **`offers`**: `@type`: `"Offer"`, `url` (ticket/website URL or canonical URL), numerical `price` (0 for free), `priceCurrency`: `"GBP"`, `availability`: `"https://schema.org/InStock"`.
- **Validation Guardrail**: `generateEventJsonLd(...)` verifies mandatory fields (`name`, `startDate`, `location.name`). If any mandatory field is missing/null, script generation is **gracefully suppressed** (`null`) to prevent Google Search Console validation warnings.

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

---

## 6. Event Publishing & Moderation Architecture

- **Instant Self-Serve Publishing**: Registered users can publish events immediately without manual probation gate delays or 5-event thresholds. Clean submissions are assigned `status = 'published'` instantly and appear in public feeds, search, and maps.
- **Automated Content & Moderation Filter**: All event submissions undergo automated content and profanity checks (`check_content_with_reason` on title, description, location, tags) and duplicate risk detection. Flagged submissions are quarantined in `status = 'pending_review'` with a detailed `moderation_reason`.
- **Asynchronous Admin Email Notifications**:
  - **Published Event Alert**: Dispatches background email to `contact@highlandeventshub.co.uk` with event title, date/time, venue/location, organizer name, creator email, ticketed status (`Yes (Native Ticketing)` or `No`), subject badge (`[🎟️ TICKETED]` when native ticketing is enabled), live link, and admin management link.
  - **Quarantine Moderation Alert**: Dispatches background email to `contact@highlandeventshub.co.uk` detailing flagged keywords, reason, event ID, organizer name, creator email, and direct link to the admin moderation queue.
- **Native Ticketing Engine (General Availability - GA)**:
  - Feature flag `TICKETING_PUBLIC_ENABLED` enabled by default (`True` in `backend/app/core/config.py`).
  - Native ticketing creation, Stripe Connect onboarding (`/api/sellers/stripe-connect/onboard`), seller status checks, and ticket tier management are accessible to all authenticated registered users.
  - Event Wizard Step 1 toggle and ticket tier configurations are open to all registered users without Admin Beta gating badges.
  - User header dropdown renders the "Organizer Hub" link for all authenticated accounts.
  - Door Scanner (`/scan/[event_id]`) includes a helpful fallback state if browser camera access is denied (*"Camera access is required to scan tickets. Please enable camera permissions in your browser settings."*).
  - **Price Formatting & Native Ticketing Price Synchronization**:
    - **Display Formatting Helper (`formatPrice.ts`)**: Pure numerical strings without currency symbols (e.g. `"15"`, `"15.50"`, `12`) automatically prepend `£` (e.g. `£15`, `£15.50`, `£12`), while zero/free variants (`0`, `"0"`, `"Free"`, `"FREE"`) format cleanly as `"Free"`. Pre-formatted or custom strings (e.g. `£10 - £15`, `Donation`, `From £10.77`) are preserved without double-prepending.
    - **Event Wizard Price Locking**: When `is_ticketing_enabled` is active, the manual Price input in Step 1 is disabled (read-only state) with an informative placeholder (*"Auto-calculated from ticket tiers (incl. fees)"*).
    - **Dynamic Tier Derivation**: As ticket tiers are added or modified in Step 3, the event display price is computed based on buyer price ($\text{Tier Base Price} + \text{Platform Fee}$ when pass-through is active). Single tiers display as `£X.XX` (or `Free`); multiple tiers display as `From £X.XX`.
    - **Backend Synchronization**: `POST /api/events`, `PUT /api/events/{id}`, and tier management routes (`POST/PUT/DELETE /api/events/{id}/tiers`) validate and synchronize `event.price`, `event.price_display`, and `event.min_price` directly with configured ticket tiers.
  - **Marketing & Discovery Launch Architecture**:
    - **Top Sticky Announcement Bar (`TicketingAnnouncementBanner.tsx`)**: Rendered inside `Header.tsx` at the top of the viewport above desktop and mobile navigation. Features brand styling (`#0B3B2C`), compact height (<40px), copy informing organisers of direct Stripe payouts and lower fees, link to `/sell-tickets`, accessible dismissal button, and persistent `localStorage` dismissal state (`key: he_hub_ticketing_banner_dismissed`).
    - **Homepage Bottom CTA Card (`pages/index.tsx`)**: Updated card with headline *"Fill Your Venue. Sell Your Tickets."*, conversion body copy highlighting Highland audience reach, direct Stripe bank payouts, and door check-in, paired with dual actions ("List an Event" routing to `/submit-event` and "See ticketing fees and features →" routing to `/sell-tickets`).
    - **Dedicated `/sell-tickets` Landing Page (`pages/sell-tickets.tsx`)**: Comprehensive organizer landing page featuring:
      - Hero section with key value proposition and smooth-scroll CTA to comparison table.
      - 3-Step "How It Works" grid (List in 90s $\to$ Connect Bank via Stripe $\to$ Door QR scanner).
      - Transparent Platform Comparison Table comparing Highland Events Hub against Eventbrite, Skiddle, and Ticketmaster across platform fees (4.5%–5% + 30p), direct Stripe payouts, 100% Highland discovery focus, smartphone door scanner, and free community event listing.
      - Interactive Organiser FAQ covering automatic payouts, equipment-free door scanning, fee pass-through transparency, and refund management.
      - High-converting launch incentive CTA offering guaranteed regional homepage feature placement for the first 5 ticketed events.
  - **Legal Consent & Terms Acceptance Architecture**:
    - **Organiser Clickwrap Agreement (`StepReview.tsx` / `useEventWizard.ts`)**:
      - Renders conditionally on the final Review step of the Event Submission & Edit Wizard only when `is_ticketing_enabled` is active.
      - Mandates an explicit, unchecked-by-default checkbox: *"I agree to the [Organiser Terms of Service](/terms#organiser) and confirm that I am responsible for hosting this event and issuing refunds if the event is cancelled or rescheduled."*
      - Opens terms in a separate tab (`target="_blank" rel="noopener noreferrer"`) preserving in-progress form state.
      - Frontend validation blocks form submission with an inline error if unticked.
      - Backend schemas (`EventCreate`, `EventUpdate`) and API endpoints (`POST /api/events`, `PUT /api/events/{id}`) strictly validate `terms_accepted == True` when enabling native ticketing, returning HTTP 400 otherwise.
      - Standard non-ticketed (free) events are not blocked and display the standard platform terms disclosure.
    - **Attendee Ticket Checkout Disclosure (`CheckoutModal.tsx`)**:
      - Frictionless legal consent notice positioned immediately above the primary payment trigger buttons (*"Pay £X.XX"* and *"Claim Free Tickets"*).
      - Text: *"By completing this purchase, you agree to our [Terms of Sale](/terms#ticketing) and [Privacy Policy](/privacy)."*
      - Both links open in a new tab (`target="_blank" rel="noopener noreferrer"`) with readable secondary styling (`text-xs text-neutral-500`).
    - **Terms Page Architecture (`pages/terms.tsx`)**:
      - Responsive 2-column layout on desktop (`lg:grid lg:grid-cols-12`) with a sticky Table of Contents sidebar (`sticky top-24`) featuring `IntersectionObserver`-linked active section highlighting.
      - Mobile sticky horizontal quick-jump pill bar (`lg:hidden sticky top-16`) for smooth scrolling.
      - All section headers use `scroll-mt-28` to guarantee clean visual offset below the sticky navigation and announcement bars.
      - 8 comprehensive legal sections governed under Scots law:
        1. `id="general"`: General Website Terms (Acceptance, platform intermediary role, "as is" availability).
        2. `id="content"`: User-Generated Content & Submissions (Accuracy, IP warranty, third-party copyright indemnification, non-exclusive platform license, content moderation).
        3. `id="ticketing"`: Attendee Ticket Purchase Terms (Contract of sale direct with organiser, all sales final / non-refundable, cancellation refunds from organiser, non-refundable booking fees, QR code entry conditions).
        4. `id="organiser"`: Event Organiser Terms & Merchant Agreement (Stripe Connect direct payouts, platform service fees, Consumer Rights Act compliance, 100% organiser chargeback/dispute liability & £15 dispute fees, account enforcement).
        5. `id="featured"`: Featured Listings Advertising Terms (Immediate consumption of digital ads, review & automatic pre-publication refunds, no post-publication refunds).
        6. `id="liability"`: Limitation of Liability & Cap (Exclusion of consequential damages, liability cap limited to 12-month platform fees or £100).
        7. `id="governing-law"`: Governing Law & Jurisdiction (Scots law, exclusive jurisdiction of Scottish courts).
        8. `id="contact"`: Contact Information (`contact@highlandeventshub.co.uk`).
  - **Single-Session / 36-Hour Constraint (Permanent Platform Safeguard)**:
    - **Frontend Event Wizard**: Step 1 displays micro-copy note outlining the single-event / overnight limit. Step 2 automatically locks pattern selection to "One-Off Event", greys out and disables "Recurring Event" and "Various Dates & Times" with an "Unavailable with Native Ticketing" badge and informative toast, shows an inline duration warning, and disables the "Next" button if duration exceeds 36 hours.
    - **Backend API**: `POST /api/events` and `PUT /api/events/{id}` strictly validate that any ticketed event is non-recurring (`is_recurring == False`, `recurrence_rule == None`, `frequency == None`, and empty `showtimes`) and that duration `(date_end - date_start) <= 36 hours` (allowing overnight sessions up to 36 hours), raising HTTP 400 otherwise.

---

## 7. Mobile Navigation & Filter Architecture

- **Mobile Header (`Header.tsx`)**:
  - Contains site title, notification bell, and Profile/Account avatar/link adjacent to the bell.
  - Retains scroll-linked sticky reveal/hide animation (`translate-y-0` on scroll-up, `-translate-y-full` on scroll-down).
- **Mobile Bottom Navigation (`BottomNavBar.tsx`)**:
  - 5-item bottom bar ordered left-to-right: Home (`/`) | Events (`/events`) | Create (`/submit-event` elevated primary button) | Map (`/map`) | Discover (`/venues` with Compass icon).
- **Condensed Mobile Filters & Internal Links**:
  - Category and location pills use horizontal touch-scrolling (`flex-nowrap md:flex-wrap overflow-x-auto whitespace-nowrap scrollbar-hide snap-x`) and compact padding (`px-3 py-1.5 md:px-5 md:py-2.5 text-xs md:text-sm`).
  - All location pills in `PopularLocations.tsx` render as hard Next.js `<Link>` components routing directly to `/locations/${location.slug}` for optimal SEO crawlability.

---

## 8. Organizer Hub & Ticketing Management Architecture

- **Unified Hub Endpoints (`/organizers/hub`)**:
  - `GET /api/organizers/events` & `GET /api/ticketing/organizer/events`: Returns ticketed events owned by the user or organizer profiles, check-in stats, scanning URLs, and cancellation metadata.
  - `GET /api/organizers/invoices` & `GET /api/ticketing/organizer/invoices`: Returns consolidated order line items, UK tax year breakdowns, platform fee statements, and net payouts.
- **Authenticated CSV Attendee & Tax Export**:
  - `GET /api/ticketing/organizer/events/{event_id}/export-attendees` (with backward-compatible `/export-guests` alias): Requires authenticated seller credentials (`Bearer <token>`) and returns dynamic CSV streaming with `Content-Disposition: attachment; filename=attendees_{event_id}.csv`.
  - Frontend utilizes authenticated blob fetching with error parsing and automatic object URL cleanup.

---

## 9. Geographic Hubs & SEO Management Architecture

- **Geographic Hubs Management (`/admin/curated?tab=hubs`)**:
  - Full CRUD functionality for geographic location hubs (e.g. Inverness, Aviemore, Dornoch, etc.).
  - Admin creation interface with auto-slug generation, manual slug overrides, SEO title/description metadata, hero banner image uploads via Cloudflare Images, featured event pickers, and official partner branding/links.
- **Backend Endpoints (`/api/locations`)**:
  - `POST /api/locations`: Admin-only creation with slug conflict validation and sanitization.
  - `PUT /api/locations/{id}`: Admin-only update for name, slug, SEO metadata, hero image, and partner details.
  - `DELETE /api/locations/{id}`: Admin-only deletion of location hub records.
  - `GET /api/locations`: Public list of all geographic hubs.
  - `GET /api/locations/feed/{slug}/{timeframe?}`: Public feed supporting `/locations/[city]` and timeframe sub-routes.

---

## 10. Door Scanner & Organizer Ticket Sale Notifications Architecture

- **Door Scanner Page & Hub (`/organizers/scanner` & `/scan/[event_id]`):**
  - All React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) are unconditionally evaluated at the top of functional components prior to loading and auth gating returns, preventing React Hook Order crashes (Error #310).
  - Gate check-in camera, manual code entry (`HEH-XXXXXX` / Ticket ID), and live guest list search validate ticket QR tokens with audio/visual feedback.
- **Organizer Ticket Sale Email Alerts:**
  - On Stripe payment completion (`webhooks.py` / `stripe_service.py`), after issuing the buyer booking confirmation receipt, the system resolves the event organizer (`event.organizer.email` or `event.organizer_profile.contact_email` or `event.ticket_support_email`).
  - Dispatches an automated email alert with subject `🎟️ Ticket Sold: [Event Title] - Order #[order_ref]`, sale details (tier purchased, quantity, gross total, buyer name/email), and direct CTA links to the Organizer Hub (`/organizers/hub`).
  - Wrapped in safe `try/except` handlers to ensure payment fulfillment and webhook response status remain unaffected by external email transport delays.
- **In-App Notification Records (`NotificationType.TICKET_PURCHASED`):**
  - Creates a persistent database notification (`title = "New Ticket Sale!"`, `message = "${qty}x ${tier_name} sold for ${event.title} (£${order.total_amount:.2f})"`, `link = "/organizers/hub"`, `is_read = False`) targeting the organizer user.
  - Dynamically increments the header notification bell unread badge and routes directly to `/organizers/hub` on click.




