# Phase 2.6: Search Intelligence & Engagement Polish
**Project:** Highland Events Hub
**Objective:** Turn "Failed Searches" into business leads, fix Recommendation logic, and polish the Groups/Feed experience.

---

## 🕵️ Sprint 1: Search Intelligence (The "Gap" Detector)
**Goal:** distinct analysis for Keyword vs. Location searches to find content gaps.

### 1. Update Analytics Capture
* **Component:** `useAnalytics` (or your search submit handler).
* **Logic:** When logging a `search_query` event, add specific context to the `meta_data`:
    * `type`: 'keyword' OR 'location'.
    * `source`: 'home_hero', 'events_page', 'navbar'.
    * `result_count`: (Integer) - *Crucial: Only log as "Failed" if count is 0.*

### 2. Admin "Missed Opportunities" Widget
* **Target:** Admin Dashboard (Analytics Tab).
* **Query:**
    * Filter `analytics_events` where `event_type` = 'search_query' AND `result_count` = 0.
    * Group by `meta_data->>term`.
* **Display:** Two simple lists.
    * **"Missing Locations":** (e.g., Aviemore, Skye). -> *Action: Recruit venues here.*
    * **"Missing Topics":** (e.g., Jazz, Pottery). -> *Action: Find organizers.*

---

## 🧠 Sprint 2: Smart Recommendations & Social Proof
**Goal:** Show relevant content and prove event popularity.

### 1. "Fresh" Recommendations
* **Logic:** Update `getRecommendedEvents`.
    1.  Fetch the user's `bookmarked_event_ids`.
    2.  Apply Filter: `.not('id', 'in', bookmarked_event_ids)`.
    * *Result:* Users never see events they have already saved.

### 2. Similar Events Engine (Fix)
* **Current Status:** Likely broken query or strict filtering.
* **Logic:**
    * Fetch events with **Same Category** OR **Matching Tags**.
    * **Critical:** Exclude the *current* event ID (`.neq('id', currentEventId)`).
    * **Sort:** By Date (Future only).
    * **Limit:** 3 or 4 cards.

### 3. Bookmark Count (Social Proof)
* **Target:** Single Event Page Hero.
* **Logic:**
    * Query: Count rows in `bookmarks` table where `event_id` = current ID.
    * **Display:** Small badge next to the "Save" button: *"Saved by 12 people"* (Only show if > 0).

---

## 🛠 Sprint 3: Bug Fixes & Groups Power
**Goal:** Fix the "TBA" bug and make Groups searchable.

### 1. Fix "My Feed" Locations ('TBA' Bug)
* **Problem:** Magazine Cards in "My Feed" show 'TBA' for location.
* **Diagnosis:** The `getFollowedEvents` query is missing the relation join.
* **Fix:** Ensure the Supabase/SQL query includes:
    * `select: '*, venue(name, town, region)'`.
    * Ensure the frontend card component maps `event.venue.town` correctly.

### 2. Groups Directory Search
* **Target:** `/groups` (Organizer Directory).
* **Features:**
    * **Search Bar:** Filter by Group Name.
    * **Category Filter:** (If groups have categories/types).
* **Implementation:** Client-side filtering is likely fine (unless you have >100 groups).
    * *State:* `searchQuery` string.
    * *Filter:* `groups.filter(g => g.name.toLowerCase().includes(query))`.

---

## 🚫 Critical Constraints
1.  **Search Privacy:** Do not log *who* searched for what in the public logs, just *what* was searched.
2.  **Performance:** "Similar Events" queries can be heavy. Ensure they are indexed by Category/Tags.