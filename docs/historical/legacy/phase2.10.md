# Phase 2.10 – Implementation Plan (Finalised)

This document defines the required updates for Phase 2.10 of the Highland Events web application. It includes all fixes, UX improvements, admin enhancements, media handling, and search/filter stability items to stabilise Phase 2 before moving to Phase 3.

---

# ✅ Overview
Phase 2.10 is a "stabilisation + polish" release that focuses on making the core features reliable, usable, and production-ready. It **does not** include monetisation, check-ins, or real-time features; those remain for Phase 3.

The items below are prioritised: critical bug fixes first (filters, images, stats), then UX and admin improvements, then performance and defensive features.

---

# 1. Category System Improvements

## 1.1 Summary
- Category CRUD is implemented. Remaining work: **category images** for the home page and admin UI.

## 1.2 Tasks
- Add `image_url` to category schema (DB migration).
- Add Cloudinary upload endpoint for category images.
- Update admin category edit/create UI to accept image uploads and preview the image.
- Update homepage category grid to display category image with gradient overlay and title.
- Ensure slug/name remain admin-controlled; users cannot create categories.

---

# 2. Tag System Enhancements

## 2.1 Summary
- Users can already create tags; implement autocomplete and deduplication.

## 2.2 Tasks
- Add `/tags/search?q=` endpoint supporting prefix search, paginated, returning tag name and usage count.
- Normalise tags before storing: trim, lowercase, collapse internal whitespace, replace spaces with hyphens for canonical slug.
- On event create/edit UI: implement tag autocomplete with debounced API calls (min 2 chars). Allow selecting existing or creating a new tag only if there is no close match.
- Admin endpoint to merge or delete tags (admin-only).

---

# 3. Location & Maps

## 3.1 Summary
- Add UK postcode lookup + geocoding; show small embedded maps on event and venue pages.

## 3.2 Tasks
- Integrate Ideal Postcodes or OS Places (or Google Geocode if preferred) for postcode → address + lat/lng.
- Add admin postcode lookup UI and button "Lookup address" that fills address fields and lat/lng.
- Persist `address_full`, `postcode`, `lat`, `lng` columns for venues and events (migrations required).
- Add lightweight Map component (Mapbox GL or Leaflet) used as a collapsible mini-map on event and venue pages.
- Implement distance calculations and indexes if needed for later recommendations/search.

---

# 4. Venue Management Improvements

## 4.1 Summary
- Venue CRUD exists; add search, postcode autofill + geocoding, hero image upload, and a venue-events list on the public page.

## 4.2 Tasks
- Add server-side `/venues/search?q=&postcode=&page=` endpoint (supports name, postcode, town).
- Replace admin venue list with searchable, pageable list; enable sorting.
- Add Cloudinary image upload for venue hero images; save `image_url`.
- On venue detail (public): add a paginated list of upcoming events for that venue.
- Add a map preview on venue detail and admin edit view.
- Add validation for incomplete addresses.

---

# 5. Event Management Improvements

## 5.1 Summary
- Event CRUD exists. Add: ticket URL field, age restriction, improved image handling, venue typeahead, map preview, and date validation.

## 5.2 Tasks
- DB migrations: add `ticket_url`, `age_restriction`, and `featured_image_url` (and optional `image_urls` JSON array) to events table.
- Image handling:
  - Integrate Cloudinary uploads for events (1–2 images).
  - On upload, generate responsive variants.
  - Allow replace/delete of images from event edit UI.
- Venue selection:
  - Replace large dropdown with async typeahead search (calls `/venues/search?q=`).
  - Show address snippet in dropdown results.
- Date validation:
  - Enforce `end_date >= start_date` client-side and server-side.
  - Add helpful error messages and disable save until valid.
- Map preview:
  - Show mini-map on event edit page and event public page using event venue coords.

---

# 6. Event Listing & Filter Fixes

## 6.1 Summary
- Fix category/tag filtering on initial page load; add date search and age restriction filters.

## 6.2 Tasks
- Events page must read URL query params (`category`, `tag`, `start_date`, `end_date`, `age_restriction`, `q`) on load and fetch filtered results automatically.
- Ensure backend events query supports filtering by category slug and tag slug.
- Implement date-range filter UI and preset shortcuts (Today, This weekend, This month).
- Add age restriction filter to search.
- Make search results paginated and expose total counts for frontend.

---

# 7. Dashboard Fixes

## 7.1 Summary
- Stats on user account page not reflecting created events; fix counts and add upcoming/past split.

## 7.2 Tasks
- Add backend endpoints for user event summary: `/users/{id}/stats` returning counts for total events, upcoming, past, drafts, check-ins (placeholder).
- Update frontend to call this endpoint and display accurate numbers.
- Ensure creating/updating/deleting events triggers cache invalidation if stats are cached.

---

# 8. Venue Page Event Listing

## 8.1 Summary
- Show upcoming events on venue public page and in admin view.

## 8.2 Tasks
- Add `/venues/{id}/events` endpoint with pagination and optional `status` filter (upcoming, past).
- Frontend: render a compact card list of venue events on the venue page.

---

# 9. Navigation & Create Event Flow

## 9.1 Summary
- Add a clear "Home" link and a prominent "+ Create Event" button in the main navigation for logged-in users.

## 9.2 Tasks
- Nav changes: Add "Home" anchor linking to `/` and add a primary CTA button "+ Create Event" linking to `/events/new` (visible for authenticated users).
- Consider a floating action button on mobile for quick create.

---

# 10. Social Sharing

## 10.1 Summary
- Add social sharing buttons on event pages and generate OG tags for social previews.

## 10.2 Tasks
- Add share buttons: Facebook, X/Twitter, WhatsApp, Messenger, Copy link.
- Implement server-side or meta tag generation for Open Graph / Twitter cards (title, description, image).
- Add a small share modal for mobile.

---

# 11. Admin Panel Enhancements (CMS-lite)

## 11.1 Summary
- Convert admin into a CMS-lite capable of media uploads, search, moderation queues, and basic user management.

## 11.2 Tasks
- Dashboard widgets: Total users, Total events, Total venues, Pending approvals, Reported events count.
- Categories UI: image upload, description, activation toggle, display order.
- Venues UI: search, image upload, address lookup, event list, map preview.
- Events UI: manage images, ticket URL, approval queue, flagging view, bulk approve/delete actions.
- Users UI: list, search, deactivate, view counts and activity.
- Reports queue: list reports, view details, take action (remove, warn user, ignore).

---

# 12. Performance & UX

## 12.1 Summary
- Add pagination and debounced search; improve image loading UX.

## 12.2 Tasks
- Add server-side pagination for events, venues, tags, admin lists.
- Implement client-side infinite scroll or page-based navigation depending on UX tests (prefer page-based for SEO and stability).
- Add skeleton loaders for lists and image placeholders.
- Debounce all free-text search inputs (300–500ms).
- Add indexing to DB for `category`, `date_start`, `venue_id`, `tags`.
- Add rate-limiting (throttle) for submissions and search endpoints.

---

# 13. Integrations & Storage

## 13.1 Cloudinary
- Use Cloudinary for category, event, and venue images.
- Store canonical URL in DB.
- Provide delete endpoint and admin deletion.

## 13.2 Geocoding provider
- Ideal Postcodes / OS Places recommended for UK postcode lookup; fallback to Google Geocode if needed.

---

# 14. QA & Testing Checklist

- Unit tests for API filtering by category & tag.
- Integration tests for event create → image upload → event fetch shows image.
- E2E tests for venue typeahead selection in event create flow.
- Manual QA checklist: create event with image, create venue via postcode lookup, filter by category via URL, check dashboard counts update.

---

# 15. Non-Goals (Phase 3)
- Points system & anti-abuse logic
- Check-in flows
- Full email automation
- Venue owner self-service portal
- Major homepage redesign (magazine layout)
- Real-time features

---

# 16. Deployment & Rollout Plan

- Deploy to staging first; run smoke tests for image uploads, filtering, and mapping.
- Monitor logs for geocoding errors and Cloudinary failures.
- Rollout to production after QA sign-off.

---

# 17. Implementation Phases (Suggested Sprints)

**Sprint 1 — Critical fixes (1–2 weeks)**
- Fix filter on load (category/tag URL handling)
- Event image pipeline (Cloudinary upload + save URL)
- Dashboard stats fix
- Venue typeahead for event create

**Sprint 2 — Admin & Media (1–2 weeks)**
- Category images
- Venue hero image + postcode lookup
- Map previews on event & venue pages
- Tag autocomplete

**Sprint 3 — UX & Performance (1–2 weeks)**
- Pagination, skeleton loaders
- Debounced searches
- Share buttons + OG tags
- Admin reports queue and user management

**Sprint 4 — QA & Stabilise (1 week)**
- Tests (unit, integration, E2E)
- Staging deploy & smoke tests
- Production deploy after sign-off

---

# 18. Acceptance Criteria

- Clicking a category/tag on homepage loads `/events?category=slug` (or `?tag=slug`) and shows filtered results on initial load.
- Uploading an image when creating an event persists the image and displays it on event and homepage cards.
- Selecting a venue via typeahead in the event create flow works reliably and fills venue id.
- Dashboard counts reflect created events and split upcoming/past.
- Venue pages show the associated upcoming events list.

---

# 19. Next Steps

1. Approve this Phase 2.10 plan.
2. I will generate a Claude Code Superpowers Plan→Execute prompt that will:
   - Create the required files and migrations
   - Implement backend endpoints
   - Update frontend pages & components
   - Add Cloudinary + geocoding hooks
3. Execute sprints in sequence and iterate with QA after each sprint.

---

*End of Phase 2.10 Implementation Plan*