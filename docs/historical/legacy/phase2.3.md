Phase 2.3: Community, Data Control & Smart Discovery (Master Spec)
Project: Highland Events Hub Objective: Enable User/Venue editing, implement Recurring Events (User Friendly), and refine Map/Venue logic.

📅 Sprint 1: The "Organizer" & "Recurring" Engine
Goal: Establish complex data relationships with zero technical jargon and NO UI CLUTTER.

1. The Organizer Entity (Groups)
Database Schema (organizers table):

id (UUID, Primary Key)

name (Text, Required)

slug (Text, Unique) - Auto-generated from name.

description (Text)

logo_url (Text)

website_url (Text)

social_links (JSONB) - e.g., { "facebook": "url", "instagram": "url" }.

Update events table: Add organizer_id (UUID, Foreign Key, Nullable).

Admin UI:

Create Event Form: Add an "Organizer" searchable dropdown (combobox).

Frontend UI:

Organizer Profile (/groups/[slug]): Full-width Hero with Logo + Name. Below: Reuse EventsGrid filtered by organizer_id.

Event Sidebar: Add "Hosted By" widget: [Logo] [Name] -> Links to Profile.

2. Recurring Events Engine (The "Clean Feed" Logic)
Database Schema Updates:

is_recurring (Boolean, Default: false)

parent_event_id (UUID, Self-Reference, Nullable) - Points to the original "Master" event.

recurrence_rule (Text, Nullable) - Stores the RRULE string internally.

Creation UI (Human Friendly - NO JARGON):

Remove: The "RRULE" Dropdown.

Add: A simple Toggle Switch: "Repeats Weekly?"

Logic:

If ON: Backend sets recurrence_rule to FREQ=WEEKLY and recurrence_end_date to NULL (Forever).

Generation: Backend immediately generates instances for the next 90 days.

Cron Job: A nightly script checks active recurring events. If the last instance is < 30 days away, generate the next batch.

Display Logic (The De-Clutter Filter):

Critical Requirement: The EventsGrid must never show multiple instances of the same recurring event series in the main feed.

Implementation:

Fetch events matching the search/filter.

Deduplicate: Group by parent_event_id.

Select: For each group, render only the single instance closest to now().

Badge: Add a small "Weekly" badge to the card.

📅 Sprint 2: Venue Power & Logic Fixes
Goal: Fix the Venue Page bugs and give Venue Owners control.

1. Venue Page Logic Fix
Bug: Venue pages currently list all events.

Fix: In EventsGrid (or the page fetcher), ensure the Supabase query includes .eq('venue_id', venueId) when on a venue page.

2. Venue Amenities (Detailed)
Database (venues table):

is_dog_friendly (Boolean)

has_wheelchair_access (Boolean)

has_parking (Boolean)

serves_food (Boolean)

amenities_notes (Text, Optional)

UI Implementation (Icon Mapping):

Use lucide-react icons.

Dog (Dog Friendly)

Accessibility (Wheelchair Access)

Car (Parking)

Utensils (Serves Food)

Style: Render as a row of circular badges (gray background, dark icon) on the Venue Hero. Hide if false.

3. Venue Editing (Permissions)
Database: Add manager_user_id (UUID) to venues.

UI Flow:

Dashboard: Add "My Venues" tab. Fetch venues where manager_user_id === current_user.id.

Edit Form: Reuse the "Create Venue" form logic, pre-filled with existing data.

RLS Policy: UPDATE allowed ONLY if auth.uid() == manager_user_id.

📅 Sprint 3: The "Venue-Centric" Map Logic
Goal: Solve the "Overlapping Pins" problem by grouping events by venue.

1. Map Data Architecture
Concept: Pins represent Venues, not Events.

Default View: Date defaults to TODAY.

Data Transformation:

Fetch events for the selected date.

Group: Aggregate events by venue_id.

GeoJSON Point: Create one point per venue. Properties: { venue_name, event_count, event_ids[] }.

Visual: If event_count > 1, show a small badge on the pin.

2. Interaction Flow (The Drill-Down)
State A (Discovery): Sidebar lists all events in the viewport.

State B (Venue Focus):

Action: User clicks a Venue Pin.

Map: Zooms to venue, highlights pin.

Sidebar:

Show "← Back to Map Results" button.

List ONLY the events at that venue (using the event_ids from the point).

📅 Sprint 4: Smart Collections & Age Logic
Goal: Enable powerful, auto-generated collections.

1. Age Restriction Options
Data: Update age_restriction enum to: ['all_ages', 'kid_friendly', 'family', '14_plus', '18_plus', '21_plus'].

UI:

18+/21+: Red Badge.

Family/Kid Friendly: Green Badge.

2. Admin Collection Builder (No Manual URLs)
Admin UI: Replace "Target Link" text input with a Query Builder.

Inputs: Category (Dropdown), Tag (Text), Age (Dropdown), Price (Radio: Free/Paid).

Logic: Auto-generate URL string (e.g., /events?age=family&price=free).

Fallback: Small "Switch to Manual" link.

📅 Sprint 5: The "Invisible" Utilities
Goal: Trust and Sharing.

1. "Add to Calendar"
Component: AddToCalendarDropdown on Single Event Hero.

Library: add-to-calendar-button-react.

Options: Google (Web Link), Apple/Outlook (.ics download).

2. SEO & Open Graph
Next.js Metadata: Implement generateMetadata in page.tsx for dynamic routes (/events/[id], /venue/[id]).

title: Event Title

description: Summary + Date + Location.

openGraph.images: [Main Image URL].

🚫 Critical Constraints
Deduplication: The Main Feed MUST filter out duplicate recurring instances. One card per series.

No Jargon: "RRULE" and "(10 weeks)" are forbidden in the UI.

Map: Do not stack pins. Group by Venue.