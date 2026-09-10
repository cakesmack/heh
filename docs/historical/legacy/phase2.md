# Phase 2 Specification – Highlands Events Platform

This document defines the full scope of **Phase 2**, incorporating all improvements, fixes, and new features required before deployment and monetisation (Phase 3+). Phase 2 focuses on: data structure enhancements, UX upgrades, event/venue improvements, analytics, moderation, maps, categories/tags, recommendations, and performance/stability.

---

# ✅ 1. Categories & Tags System

## 1.1 Categories (Admin-Controlled)

* Full CRUD for categories via Admin Dashboard.
* Categories must include:

  * Name
  * Slug
  * Description (optional)
  * Icon/Image (optional)
* Categories should be displayed on the home page as a visual grid.
* Categories appear in the event creation form as required fields.

## 1.2 Tags (User-Generated)

* Users can add custom tags to events.
* Maximum: **5 tags per event**.
* Validation rules:

  * Normalised to lowercase.
  * No duplicates across the platform.
  * Convert spaces to hyphens.
  * Auto-suggest existing tags.
* Add a **popular tags cloud** to the home or explore page.

## 1.3 Category & Tag Filtering

* Search filters must support:

  * Single or multiple categories.
  * Tags.
  * Combined search.
* Fix mismatch issues between category dropdown values and existing events.

---

# ✅ 2. Event & Venue Media Handling

Use **Cloudinary** for image storage to ensure:

* Automatic resizing.
* Optimised formats (WebP etc.).
* Responsive image variants.
* Cached delivery via CDN.

## 2.1 Event Images

* Each event must have a featured image.
* Aspect ratio enforced (16:9).
* Fallback default image if missing.

## 2.2 Venue Images

* Venues have a featured image.
* Optional gallery support (future expansion).

---

# ✅ 3. Maps, Geocoding, & Location

## 3.1 Geocoding Pipeline

* When creating or editing events/venues, the system automatically:

  * Validates address.
  * Fetches `lat`, `lng`, and `formatted_address`.
  * Stores these values in the database.

## 3.2 Map Embeds

* Event page includes a small map showing venue location.
* Venue page includes same map.
* Map should be collapsible on mobile.

## 3.3 Location-Based Search

* Add distance filters (e.g., within 5 km, 10 km, 20 km).
* Use geospatial queries to support recommendations.

---

# ✅ 4. Event Page Improvements

## 4.1 New Layout

* Event details block (location, date, price, etc.) appears above statistics.
* Description appears on the left column.
* Featured image displayed at top.

## 4.2 Additional Features

* Social share buttons (WhatsApp, Facebook, Messenger, copy link).
* Bookmark/favourite event (requires login).
* Report event button (flags inappropriate content).
* Optional: Image modal/gallery if multiple images added in future.

---

# ✅ 5. User Dashboard Upgrades

## 5.1 Fix Existing Stats

* Current stats must reflect:

  * Number of events created.
  * Views.
  * Bookmarks.
  * Check-ins.

## 5.2 New Dashboard Widgets

* Events by category.
* Pending approvals.
* Event performance summary.

---

# ✅ 6. Analytics System

## 6.1 Tracking

Track key behaviours:

* Event views.
* Venue views.
* Category clicks.
* Check-ins.
* Bookmark actions.

## 6.2 Analytics Storage

* Store anonymised log entries.
* Use lightweight roll-up tables for performance.

## 6.3 Analytics Dashboard (Admin + Venue Manager)

* Event performance charts.
* Engagement (views, clicks, check-ins).
* Popular tags/categories.
* Growth over time.

---

# ✅ 7. Recommendations Engine

## 7.1 Inputs to Recommendation Algorithm

* User’s location (if provided).
* Categories of previously attended/bookmarked events.
* Tags interacted with.
* Venue visits or check-ins.
* Popularity of events in user’s region.

## 7.2 Features

* Recommended events section on home page (for logged-in users).
* Recommendation email (base logic only — full email system is Phase 3).

## 7.3 Cold Start Strategy

* New users get:

  * Popular upcoming events.
  * Local events near them.

---

# ✅ 8. Venue Management System

## 8.1 Claim Venue Flow

* Users may request ownership of a venue.
* Admin receives notification.
* Admin verifies and approves.
* Verification options:

  * Business email confirmation
  * Document upload (optional future)

## 8.2 Venue Roles

* Owner
* Managers
* Staff (optional future expansion)

## 8.3 Venue Insights

* Stats dashboard.
* Event performance.
* Points earned.
* Venue profile completeness.

---

# ✅ 9. Points, Badges, & Rewards System

## 9.1 Core Rules

* Users earn points for:

  * Posting events
  * Check-ins
  * Completing challenges
* Limit point farming / abuse:

  * Rate limits on earning
  * Flag suspicious activity for admin review

## 9.2 Admin Tools

* Admin can create challenges.
* Admin can award/remove points.
* Admin can view logs of point activity.

## 9.3 Badge System

* Automatic badges for milestones.
* Badges can unlock:

  * Faster posting
  * Removal of approval requirement

---

# ✅ 10. Moderation & Approval System

## 10.1 Event Approval

* New users require approval for every event.
* After earning a milestone badge, approval is no longer required.

## 10.2 Moderation Tools

* Admin view of pending approvals.
* Approve/reject with reason.
* History log.
* Bulk approval actions.

## 10.3 Auto-Flagging

* Detect offensive keywords.
* Detect suspicious activity.
* Flag events with rapid posting.

---

# ✅ 11. Notifications Framework (Base Only)

## 11.1 Email Types

Set up basic functionality:

* Event submitted for approval
* Event approved
* Event rejected
* Venue claim approved

Full recommendation digests will be Phase 3.

## 11.2 User Controls

* Easy opt-out.
* Notification preferences in settings.

---

# ✅ 12. Performance, Pagination, & API Consistency

### Implement:

* Pagination on all event/venue lists.
* Standard response formats across API endpoints.
* Basic caching (where applicable).
* Logging system for backend errors.
* Stronger input validation.

---

# ✅ 13. UX Enhancements

* Skeleton loaders for pages.
* Empty state screens (no events, no bookmarks, etc.).
* Error screens (404, permission denied, etc.).
* "Back to top" button on mobile event lists.
* Consistent spacing, typography, and mobile responsiveness.

---

# 📌 Final Note

This Phase 2 specification includes *all essential structural improvements* your app needs before deployment, payments, or large-scale promotional use.

Phase 3 will focus on:

* Email digests & notifications
* Monetisation (Stripe)
* Deployment pipeline
* Advanced real-time updates
* Full documentation

Phase 2 is the biggest engineering step — but with this spec, it's now fully defined and ready to implement.
