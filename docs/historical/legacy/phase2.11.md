## Purpose

This document is an **implementation brief** for Google Anti-Gravity to execute the **remaining work in Phase 2.10**.

All items listed here are **not yet complete** or are **partially implemented**. Anything not mentioned should be assumed **already done** and should not be reworked unless required to support these tasks.

The goal of this phase is to:

* Close functional gaps
* Stabilise admin workflows
* Complete discovery UX
* Prepare foundations for Phase 3 (monetisation, points, check-ins)

---

## 1. Hero Section – Homepage Spotlight System

### Overview

Replace the existing featured-events carousel with a **controlled hero system**.

### Requirements

* Maximum 5 slides total
* Slide 1: Welcome / Brand slide (always first)
* Slides 2–5: Homepage Spotlight slots (event-linked)

### Data Model

Each hero slot should store:

* position (1–5)
* type: welcome | spotlight_event
* event_id (nullable)
* image_override (optional)
* title_override (optional)
* cta_override (optional)
* overlay_style
* is_active
* start_date (optional)
* end_date (optional)

### Admin Functionality

* Admin page: “Hero Manager”
* Visual representation of 5 slots
* Ability to:

  * Assign an event to a slot
  * Upload / replace image
  * Toggle slot active/inactive
  * Reorder slots (except welcome)

### Frontend Behaviour

* Only active slides displayed
* Welcome slide always first
* If spotlight slots empty → fallback to existing featured events

---

## 2. Admin – Venue Improvements

### Postcode Lookup (Critical Bug)

* Fix postcode search when creating or editing venues/events
* UK-only
* On postcode selection:

  * Autofill address fields
  * Auto-generate latitude / longitude

### Venue Ownership Flow

* Users can request ownership of a venue
* Admin can approve / reject requests
* Approved owners can:

  * Edit venue details
  * Upload / change venue hero image
  * Create events for that venue

Ensure strict permission checks.

---

## 3. Venue Pages

### Required Enhancements

* Display list of **upcoming events** scheduled at the venue
* Ensure map preview works correctly
* Venue hero image displayed consistently

---

## 4. Admin – Event Management

### Missing Fields & Features

* Ticket URL field (visible on event page)
* Image management:

  * Replace image
  * Remove image

### Moderation Workflow

* Events created by users may require approval
* Admin view:

  * Pending events
  * Approval / rejection
* Maintain an approval log

---

## 5. Event Page – Missing Interactions

### Bookmark / Save Event

* Logged-in users can bookmark events
* Saved events visible on user account page

### Report Event

* Users can report events
* Reports visible in admin moderation area

---

## 6. Tags – Quality Improvements

### Requirements

* Autocomplete when adding tags
* Deduplication (case-insensitive)
* Normalisation (e.g. “Live Music” == “live-music”)

---

## 7. Admin – Analytics Expansion

### Add Metrics

* Total users count
* Events per user
* Events per venue
* Venue activity overview

No advanced charts required — simple summaries are sufficient.

---

## 8. Navigation & UX Fixes

### Required

* Explicit “Home” link in main navigation
* Global “Create Event” button (icon-based)
* Improved date picker logic:

  * End date must be after start date

---

## 9. Non-Venue & Multi-Venue Events

### Support Events That:

* Span multiple streets
* Cover a town-wide area
* Involve multiple venues

### Implementation

* Event location type:

  * Venue-based
  * Area-based
  * Multi-venue

Frontend must display location clearly without forcing a single venue.

---

## 10. Explicitly Out of Scope (Do Not Implement)

* Payments / Stripe
* Points system
* Check-ins
* Email campaigns
* Selling premium slots
* Real-time updates

Foundations may exist, but no full implementations.

---

## Completion Criteria

Phase 2.10 is complete when:

* All homepage hero logic is admin-controlled
* Venue ownership works end-to-end
* Event creation and moderation are stable
* Discovery, bookmarking, and reporting are functional
* Admin workflows feel reliable and usable

---

## Final Note

This phase is about **polish, credibility, and stability**.
Avoid redesigning existing working components unless required to complete the above tasks.
