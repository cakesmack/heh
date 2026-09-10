# Phase 3.1: Location Intelligence & Google Maps Migration

**Status:** Planned
**Objective:** Replace vague postcode data with precise Google Places data and enable "Near Me" discovery.
**Strategic Shift:** Remove Mapbox dependency; standardise on Google Maps Platform.

---

## 1. Architecture Changes

### A. The "One Map" Strategy
* **Uninstall:** `mapbox-gl`, `react-map-gl`.
* **Install:** `@react-google-maps/api` (or `@vis.gl/react-google-maps`).
* **Benefit:** Reduces bundle size, ensures the "Venue Preview" matches the "Main Map."

### B. Database & API
* **Events Table:** No changes needed (we already store Lat/Lng).
* **Events API (`read_events`):** Needs a new "Geometry Filter" to handle "Radius Search."

---

## 2. Implementation Roadmap

### Task 1: The Backend Mathematics (Distance Filtering)
* **Goal:** Allow the API to filter events within `X` miles of a user.
* **Logic:** Implement the Haversine Formula in Python/SQLModel.
    * *Input:* `lat`, `lng`, `radius_miles`.
    * *Process:* Calculate distance for every active event. Filter where `distance <= radius`.
    * *Output:* List of events sorted by `distance` (nearest first).

### Task 2: The Venue Form Upgrade (Data Quality)
* **Goal:** Stop users entering vague postcodes.
* **Feature:** **Google Places Autocomplete**.
* **Component:** `PlacesAutocomplete.tsx`
    * User types "Ironworks".
    * Google returns exact coordinates + formatted address.
    * App auto-fills hidden fields (`lat`, `lng`, `address`).
    * *Bonus:* Show a static "Mini Map" preview of the pin.

### Task 3: The "Near Me" Discovery (UX)
* **Goal:** One-tap local search.
* **Component:** `DiscoveryBar.tsx` / `EventSearch.tsx`.
* **Action:** Add a "Target" icon button.
    * On click: Browser requests GPS permission.
    * On success: Reloads Event List with `?lat=...&lng=...&radius=20`.
* **UI:** Show a "Radius Dropdown" (10m, 20m, 50m) only when location is active.

### Task 4: The Map Migration (Visuals)
* **Goal:** Replace the main `MapView.tsx`.
* **Action:** Rewrite the Mapbox component using Google Maps.
* **Markers:** Use "Advanced Markers" to render Custom Category Icons (Music = Red, Sport = Green).
* **Popups:** Re-implement the "Event Card" popup on click.

---

## 3. Risk Management

* **Cost Control:** Ensure Google API Key has "Quotas" set (e.g., max 10,000 requests/day) to prevent runaway bills.
* **Permission Denied:** If user blocks GPS, gracefully fall back to "Default View" (Inverness Centre) and show a toast notification.
* **Zero Results:** If "Near Me" returns nothing, show a friendly "No events found nearby—try a wider radius?" message.