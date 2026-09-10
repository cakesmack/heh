# Phase 2.2: Polish, Consistency & UX Refinement
**Project:** Highland Events Hub
**Current State:** Post-Phase 2.10 (Stabilization)
**Objective:** Unify search logic, polish key user flows, and remove technical debt before Phase 3 (Monetization).

---

## 📅 Sprint 1: The "Universal Search" Engine (Critical Priority)
**Goal:** Establish a single, powerful search component used across the entire application to ensure consistent behavior and deep linking.

### 1. Refactor `DiscoveryBar` (Global Component)
The `DiscoveryBar` currently on the homepage must be refactored into a reusable, context-aware component.
* **Props Interface:** Update component to accept an `initialFilters` prop (object containing: `keyword`, `location`, `date`, `category_id`).
* **Unified Keyword Logic:**
    * **Remove:** The dedicated "Tags" dropdown.
    * **Update:** The "Keyword" text input logic. On submission, the backend query must check: `Event.title` OR `Event.description` OR `Event.tags` (ILIKE match).
* **Visual Modes:**
    * *Default (Home):* Floating style (Shadow, Rounded).
    * *Embedded (Events/Category):* Full-width container style (No heavy shadow, fits content width).

### 2. Overhaul `/events` Page
The current sidebar-based filtering is deprecated. We are moving to a top-bar model.
* **Layout Change:** DELETE the left-hand filter sidebar entirely.
* **Integration:** Insert the refactored `DiscoveryBar` at the top of the main content area.
* **Deep Linking (Crucial):**
    * Implement URL Query Parameter reading on page load.
    * *Scenario:* User visits `/events?category=music&location=Inverness`.
    * *Action:* The page must initialize the `DiscoveryBar` with these values and trigger the search immediately.

### 3. Homepage "View All" Connection
* **Logic Fix:** The "View All Events" button on the Homepage must not be a static link.
* **Dynamic URL Construction:** It must read the *current* state of the Homepage Search Drawer and push the user to `/events` with those exact parameters.
    * *Example:* If Home Drawer shows "Music" in "Skye", the button links to `/events?category=music&location=Skye`.

---

## 📅 Sprint 2: Dynamic Content Pages & Visuals
**Goal:** Leverage existing Admin data to create "Landing Pages" without manual coding.

### 1. Dynamic Category Pages (`/category/[slug]`)
Create a dynamic route to act as a landing page for specific interests.
* **Template Structure:**
    * **Hero:** Full-width Cinematic Header. Use the `Category.image_url` (managed in Admin) as the background. Overlay the `Category.name` as the H1.
    * **Search:** Render `DiscoveryBar` (pre-locked to this Category).
    * **Grid:** Render the standard `EventsGrid` showing events with this `category_id`.
* **Routing:** Ensure clicking a "Category Card" on the Homepage links here, not just to a filtered events page.

### 2. Venues Page Upgrade
Convert the current text-only list into a visual discovery grid.
* **Component:** Create `VenueDiscoveryCard`.
    * *Elements:* Thumbnail Image (Top), Venue Name (Bold), Town/Location (Subtext).
* **Layout:** Responsive Grid (1 col Mobile, 3 col Desktop).
* **Search:** Add a simple top-bar search input to this page to filter venues by Name or Town client-side.

---

## 📅 Sprint 3: Homepage Polish & Navigation
**Goal:** Clean up visual hierarchy and remove "Template Filler."

### 1. Hero Section Refinement
* **Content:** Simplify text to a single, high-impact H1.
* **Actions:** Split the buttons into Primary and Secondary visual hierarchy.
    * *Primary:* "Find an Event" (Brand Color).
    * *Secondary:* "Browse Categories" (Outline/Glass style).
* **Slide Order:** Enforce "Welcome Slide" as Slide 1, followed by "Premium/Featured" event slides.

### 2. Replace "About" Section
The current "Local Events / Earn Rewards" section is vague.
* **Action:** Replace with a **"Curated Collections"** strip.
* **Content:** 3 Visual Cards linking to pre-filtered queries:
    * "Family Friendly" -> Link to `/events?category=family`
    * "Free This Weekend" -> Link to `/events?price=free&date=weekend`
    * "Live Music" -> Link to `/category/music`

### 3. Search Drawer UX
* **Bug Fix:** Ensure "Found X Results" count updates immediately when filters change, even before the list re-renders.
* **Sort Button:** Wire up the "Sort By" dropdown (Date ASC vs. Created DESC) to the backend query.

---

## 📅 Sprint 4: Account Area & cleanup
**Goal:** Simplify the user dashboard and hide unfinished features.

### 1. Account Page Layout
* **Navigation:** Implement a **Tabbed Interface** to replace the vertical stack.
    * *Tabs:* `Profile Details` | `Saved Events` | `My Venues` | `My Tickets`.
* **Mobile:** Ensure tabs are horizontally scrollable or a dropdown on mobile.

### 2. Gamification & "Ready to Explore"
* **Gamification:** Comment out/hide the "Event Stats" and "XP/Level" widgets. These are deferred to Phase 3.
* **Logged-In Logic:** Hide the "Ready to Explore" (Sign Up CTA) section on the Homepage if the user is authenticated.

---

## 🚫 Phase 2.2 Constraints (Do Not Build)
1.  **XP/Rewards System:** Explicitly out of scope. Do not build database tables for points yet.
2.  **Complex Sidebar Filters:** The sidebar is dead. Do not re-implement complex checkboxes there.
3.  **Manual Region Lists:** Continue to rely on Mapbox/Coordinates for location; do not build a "Region" admin CRUD.