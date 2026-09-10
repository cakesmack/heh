Phase 2.7: The Master Polish
Project: Highland Events Hub Objective: Complete all UI/UX cleanup, fix Admin data visibility, redesign the User Dashboard, and implement "Smart" Analytics before moving to monetization.

👤 Sprint 1: User Account & Dashboard Redesign
Goal: Implement the cleaner "Overview" layout and remove Gamification.

1. "My Account" Overview Redesign
Layout: Merge "Event Stats" and "Event Performance" into a single, wide "Overview" component (as per your screenshot).

Stats Cards:

Top Row: Total Events | Upcoming | Pending (was Drafts) | Past.

Bottom Row: Total Views | Total Saves | Ticket Clicks.

Interactivity:

Clicking "Past" (Count) -> Auto-switches the "My Events" list to the Past filter.

Clicking "Pending" -> Filters list to Pending.

Content Migration: Move the "Organizer Profiles" list from the My Events tab to the main Overview tab (bottom section or right column).

2. Gamification Removal
Action: Remove "XP", "Levels", and "Leaderboards" site-wide.

Cleanup: Remove from Database Schema (users.xp), Profile Headers, and Admin tables.

3. My Events/Venues Grid
Visuals: Switch from "List View" to "Grid View".

Cards: Use compact cards with the "Edit" (Pencil) button overlaid on the image.

Recurring Stats: Aggregate stats by parent_event_id (Series Total) instead of listing every single recurring instance.

🛠 Sprint 2: Admin Dashboard Repairs
Goal: Ensure columns show real data and fix broken actions.

1. Events Table Fixes
Data Population: Update the query to fetch relationships.

Creator: Display Username.

Organizer: Display Group Name (or "N/A").

Recurring: Display "Yes" (Icon) or "No".

Status: Ensure "Pending" vs "Approved" badges render correctly.

Features: Add a Search Bar to this table.

2. Venues Table Fixes
Bug Fix: Repair the "Stats" button action (currently erroring). Ensure it routes to a valid /admin/venues/[id]/stats page.

Columns: Show "Venue Owner" (User) if applicable.

3. Users Table & Modals
Columns: Remove XP column.

Interaction: Clicking a row opens the Admin User Modal (showing Email, Ban Status, Role) instead of a public profile.

4. Moderation Logic
Fix: Ensure events created by Admins (role: admin) or Trusted Users are auto-approved and do not appear in the Moderation Queue.

📊 Sprint 3: "Beautiful Analytics" & Search Intelligence
Goal: Upgrade the Admin Home to a "Mission Control" dashboard.

1. The Dashboard Design (Bento Grid)
Rebuild: Replace the text-heavy list with a Grid Layout.

Widgets:

"Live Pulse": Views Today / Active Users.

"Growth Graph": Line chart (Recharts/Tremor) of New Users & Events (Last 30 Days).

"Conversion Funnel": Views -> Saves -> External Link Clicks.

2. "Missed Opportunities" Widget
Logic: Analyze analytics_search events where result_count === 0.

Display:

Missing Locations: List top towns searched with no results (e.g., "Aviemore (15)").

Missing Topics: List top keywords searched with no results (e.g., "Jazz (8)").

🏠 Sprint 4: Home Page & Search Polish
Goal: Fix the "Top 10" scroll and improve recommendations.

1. "Top 10" / Popular Events
Layout: Full-width Horizontal Scroll with CSS Snap (scroll-snap-type: x mandatory).

Visuals:

Ranking: Overlay large "1", "2", "3" numbers on the card image.

Density: Reduce gap between cards.

Logic: Hide "Ready to Explore" section if session exists.

2. Latest Events Grid
Visuals:

Small Cards: HIDE description text entirely. Only show Date, Title, Category.

Padding: Reduce container padding (p-6 -> p-4) to show more image.

3. "Smart" Recommendations
Logic: Update getRecommendedEvents.

Filter 1: Exclude events the user has already Bookmarked.

Filter 2: Prioritize tags matching the user's history (Derived Interest).

🎨 Sprint 5: Event & Venue Page Redesign
Goal: "Cinematic" look and Map fixes.

1. Event Page Layout
Hero: Full-width blurred background + Sharp centered image.

Info Ribbon: High-contrast strip (Date | Venue | Price) below hero.

Header: Add "Hosted by [Group Name]" link.

Fixes:

Sticky Z-Index: Ensure CheckInBox sits above ManageEventBox.

Tags: Ensure Tags are visible below the title.

2. Venue Page Layout
Hero: Cinematic Style + Circular Avatar/Logo overlapping the bottom edge.

Tabs: Upcoming Events | About | Past Events. (No Reviews).

Sidebar: Move Map to top. Add Blocky "Contact" buttons.

Data: Remove Region from UI and DB. Fix "Unknown" Category bug.

3. Map Experience (Mobile Fix)
Mobile View: Default to Full Screen Map. Hide the list.

Interaction: Clicking a pin opens a Half-Height Modal (Bottom Sheet) with event summary.

Desktop Hover: Switch to Mapbox feature-state for smooth hover effects.