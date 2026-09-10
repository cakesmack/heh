# Phase 2.41: UI Polish & Dashboard Refactor
**Project:** Highland Events Hub
**Objective:** Fix layout redundancy, reclaim screen space, and implement the compact Admin Dashboard.

---

## 🎨 Sprint 1: Homepage Visual Hierarchy
**Goal:** Make "Popular" and "Recommended" look distinct.

### 1. Horizontal Scroll for "Popular Events"
* **Component:** Create `components/events/EventHorizontalScroll.tsx`.
* **Layout:**
    * Container: `flex overflow-x-auto snap-x scrollbar-hide gap-4 p-4`.
    * Cards: Set a fixed width (e.g., `min-w-[280px]` or `w-72`) so they don't squash.
    * **Snap:** Ensure cards snap into place when scrolling stops.
* **Integration:** Replace the "Popular Right Now" grid on the Homepage with this new component.

### 2. Spacing Adjustments
* **Recommended Section:** Keep as standard Grid (Vertical).
* **My Feed Tabs:**
    * **Action:** Reduce vertical padding on the `HomeFeedTabs` container.
    * **Target:** Change `py-12` (or similar) to `py-6` or `my-4`. ensure the tabs feel "connected" to the grid below them.

---

## 🧭 Sprint 2: Smart Navigation
**Goal:** maximize screen real estate on scroll.

### 1. Smart Navbar
* **Logic:** Track scroll direction.
    * `if (scrollY > lastScrollY && scrollY > 100)` -> **Hide Navbar** (Transform `translate-y--full`).
    * `if (scrollY < lastScrollY)` -> **Show Navbar** (Transform `translate-y-0`).
* **Constraint:** The **Sticky Search Bar** (Discovery Bar) MUST remain visible at all times. Do not hide it. It stays pinned `top-0` (or `top-[navHeight]` when nav is visible).

---

## 🛠 Sprint 3: Admin Dashboard "Cockpit"
**Goal:** Consolidate high-level stats into a dense, single-row view.

### 1. The "Platform Health" Component
* **Target:** `app/admin/page.tsx` (Dashboard).
* **Action:** Remove the 4 separate `StatsCard` components (Users, Events, Venues, Organizers).
* **New Component:** `AdminHealthStrip`.
    * **Layout:** Single Card with `grid-cols-2 md:grid-cols-4`.
    * **Internal Styling:** Divide columns with light gray borders.
    * **Content:**
        1.  **Users:** Total Count (Big) + "New this week" (Small, Green).
        2.  **Events:** Active Count | Pending Count (Red).
        3.  **Venues:** Total Count.
        4.  **Organizers:** Total Count.
* **Outcome:** This strip should be ~100px-120px height max.

### 2. Layout Cleanup
* **Graphs:** Move the "Analytics Overview" graphs UP, immediately below the new Health Strip.