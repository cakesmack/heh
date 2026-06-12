# Highland Events Hub: Homepage Architecture & Teardown Plan

**Objective:** Transform the Next.js homepage (`index.tsx`) from an image-heavy, redundant layout into a high-speed, chronologically accurate utility directory while exposing dedicated B2B monetization real estate.

**Constraints:**
- Framework: Next.js Pages Router (`src/pages/`).
- Backend: FastAPI + PostgreSQL.
- Adhere strictly to the routing and SEO rules defined in `events_hub_context.md`. Do not break SSR 301 redirects.
- Execution must be phased. Do not proceed to a new phase until explicitly instructed.

### Phase 1: Component & API Demolition
- **Target:** Locate and delete the React components for "Recently Added", "My Feed", and the three informational text columns located below the hero.
- **Backend Cleanup:** Identify and delete the corresponding FastAPI endpoints that serve "Recently Added" and "My Feed". Drop any PostgreSQL indexes used exclusively by these queries.
- **Optimization:** Strip all background images from the "Categories" and "Locations" UI components. Convert them into minimal, CSS-only pill buttons and text links to eliminate payload weight.

### Phase 2: Hero & Search Restructure
- **Target:** The main hero container (`index.tsx`).
- **Demolition:** Remove the current side-by-side hero layout and the desktop sidebar collections.
- **Implementation:** - Build a single, full-width hero block with a dark gradient overlay.
  - Center the primary database search bar (including location/date parameters) exactly in the middle of the viewport.
  - Insert a subtle text link directly below the search bar: "Promoter or Venue? Add your event for free." linking to the submission form.
  - **Mobile Logic:** Ensure the hero layout stacks cleanly on mobile, maintaining the search bar at the top of the visual hierarchy.

### Phase 3: The Row Architecture (Strict Sorting)
Replace the existing grids with horizontal scrolling rows.
- **Row 1 - Spotlight (Monetization):** Max 4 cards. Query: `WHERE is_featured = true`.
- **Row 2 - Happening Next (Utility):** Max 10 cards. Query: `ORDER BY start_date ASC` strictly from `NOW()`. Exclude any event IDs already displayed in Row 1.
- **Row 3 - Top 10 Popular (Discovery):** Sort by highest user Saves/RSVPs OR filter for events where `start_date > NOW() + INTERVAL '72 hours'`.
- **Row 4 - Curated Collections:** Standard horizontal layout.
- **Row 5 - Top Venues:** Retain the circular UI layout in a single horizontal scroll.

### Phase 4: B2B Ad Real Estate & Repositioning
- **Target:** The space directly above the "Categories" pill buttons.
- **Implementation:** Insert a static, full-width container formatted for flat, greyscale B2B logos. Title it "Local Partners".
- **Repositioning:** Move the green "Fill Your Venue. Find Your Crowd." B2B banner to sit immediately above the global footer component.

### Phase 5: Admin Dashboard Refactoring
- **Target:** The admin control panel React components and corresponding FastAPI routes.
- **Cleanup:** Remove the old "Hero Settings" block entirely (frontend forms, backend logic, and database columns).
- **Refactor:** Update the "Featured Ads" management panel to align with the new Spotlight row logic, enforcing a hard cap of 4 active slots.