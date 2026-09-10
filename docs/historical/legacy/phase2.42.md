Phase 2.42: The "Polish & Power" Update (Master Spec)
Project: Highland Events Hub Objective: Finalize UI layouts (Events/Venues), fix Account/Admin logic, and polish the Home Page.

🏠 Sprint 1: Home Page Polish
Goal: Fix layout issues and recommendations.

1. "Ready to Explore" Section
Logic: Use conditional rendering to completely hide this section if a user session exists. Logged-in users should see content, not marketing.

2. Popular Events (The "Netflix" Strip)
Layout: Implement a full-width horizontal scroll container.

Style Update:

Density: Reduce the gap between cards to create a dense, "browsable" feel.

Ranking: Overlay a large, semi-transparent Number (1, 2, 3...) on the bottom-left of the card image to indicate rank.

Card Dimensions: Use a slightly narrower card width than the standard grid to visually distinguish it as a "strip."

3. Smart Recommendations
Current State: Generic.

Fix: Update the recommendation logic to prioritize relevance.

Primary Filter: Look for events with tags matching events the user has previously saved or viewed.

Secondary Filter: Look for events in categories the user follows.

Fallback: If no history exists, default to random popular events.

👤 Sprint 2: Account & Organizer Experience
Goal: Clean up the User Dashboard and handle Recurring Stats.

1. My Events & Venues (Visual Upgrade)
Layout: Switch from the current "Table List" to a "Grid of Cards".

Cards: Use compact versions of the main event card.

Actions: Overlay an "Edit" (Pencil) button directly on the card image for quick access.

Organizer Profile: Move "Organizer" settings to a dedicated Tab in the Dashboard (e.g., My Profile | My Organizers | My Venues).

2. Event Performance (Aggregation Logic)
Problem: Stats currently show every single instance of a recurring event as a separate row.

Fix: Update the Stats Query to aggregate data.

Logic: Group results by the Parent Event ID.

Metrics: Sum the views, clicks, and saves for the entire series.

UI: Display a single row per Event Series in the stats table.

🧭 Sprint 3: The Admin Dashboard (Comprehensive)
Goal: Fix navigation, data visibility, and CMS powers.

1. Sidebar & Navigation
Missing Links: Add a link for Groups (Organizers) to the main navigation.

Reorganization: Group the sidebar links into logical categories (e.g., "Management" for entities, "System" for settings/tags) to reduce clutter.

2. Dashboard Logic Fixes
Organizers Count: Fix the query counting Organizers (currently showing zero).

Moderation Logic:

Admins: Ensure events created by Admins bypass the moderation queue entirely.

Trusted Users: Ensure events from users with a high trust level (or >5 approved events) bypass the queue.

3. Entity Tables (Events, Venues, Users)
Events Table:

Add a Search Bar to filter the list.

Columns: Ensure Title, Creator, Organizer (Group), Status, and Recurring indicators are visible.

Action: Clicking a row should open the Public Event Page.

Venues Table:

Columns: Name, Manager, and a working "Stats" button.

Action: Clicking a row should open the Public Venue Page.

Users Table:

Action: Clicking a row should open a dedicated Admin User Modal.

Modal Content: Display full details (Username, Email, Trust Level, Block Status) for admin purposes. Do not link to a public profile here.

4. Hero CMS Upgrade
Database: Update the hero settings table to include fields for Subtitle, Primary CTA (Text/Link), and Secondary CTA (Text/Link).

Admin UI: Update the Hero Edit Form to include inputs for all these new fields.

🎨 Sprint 4: Event & Venue Page Redesign
Goal: "Cinematic" look and better hierarchy.

1. The "Cinematic" Hero (Events & Venues)
Design: Implement a full-width blurred background image with the sharp, original image centered in the foreground.

Venue Special: Add a circular Avatar/Logo component overlapping the bottom edge of the banner.

2. Event Page Layout
Info Ribbon: Create a high-contrast strip below the hero displaying critical info (Date, Venue, Price) icons.

Organization Link: Display "Hosted by [Group Name]" prominently in the header.

Layout: Ensure the main content uses a wide layout with a sticky sidebar for the "Get Tickets" action.

3. Venue Page Layout
Tabs: Implement a tabbed interface: [Upcoming Events] | [About] | [Past Events].

Sidebar: Move the Map to the very top. Add large, blocky buttons for Contact actions (Website, Call, Directions).

Data Cleanup:

Category: Fix the join to ensure the Category Name is displayed (not "Unknown").

Region: Format the region text to be human-readable (remove underscores).

Claim Logic: If the venue has no manager, display a prominent "Claim This Venue" button in the Hero area.

👥 Sprint 5: Groups & Images
Goal: Allow Groups to have branding.

1. Group Branding
Database: Add a column for the Hero Image URL to the organizers table.

UI:

Edit Form: Add an image uploader for the Hero image.

Group Page: Implement the same "Cinematic Hero" design used for Venues.
