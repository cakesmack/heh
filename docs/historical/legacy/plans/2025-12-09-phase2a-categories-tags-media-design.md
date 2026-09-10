# Phase 2A Design: Categories, Tags & Media

**Created:** 2025-12-09
**Status:** Approved
**Scope:** Categories system, tags system, media handling, geocoding improvements

---

## Overview

This design covers the data foundation layer of Phase 2:
- Admin-controlled categories with visual grid display
- User-generated tags for events (max 5 per event)
- Image upload with local storage (Cloudinary-ready abstraction)
- Mapbox geocoding integration for address autocomplete

---

## 1. Data Models

### 1.1 Category Model

```python
Category
├── id: UUID (primary key)
├── name: str (required, unique) - e.g., "Live Music"
├── slug: str (required, unique) - e.g., "live-music"
├── description: str (optional) - short description for tooltips/SEO
├── image_url: str (optional) - background image path
├── gradient_color: str (required) - hex colour for overlay, e.g., "#8B5CF6"
├── display_order: int (default 0) - for controlling grid order
├── is_active: bool (default True) - soft delete/hide
├── created_at: datetime
├── updated_at: datetime
```

### 1.2 Tag Model

```python
Tag
├── id: UUID (primary key)
├── name: str (required, unique) - normalised lowercase, hyphens for spaces
├── usage_count: int (default 0) - for popular tags cloud
├── created_at: datetime

EventTag (junction table)
├── event_id: UUID (foreign key)
├── tag_id: UUID (foreign key)
├── created_at: datetime
```

### 1.3 Event Model Updates

```python
Event (existing model, modified)
├── category_id: UUID (foreign key to Category) - replaces string category field
├── image_url: str (optional) - featured image path
├── tags: relationship to Tag via EventTag
```

### 1.4 Venue Model Updates

```python
Venue (existing model, modified)
├── image_url: str (optional) - featured image path
├── formatted_address: str (optional) - geocoded address from Mapbox
```

---

## 2. Media Handling

### 2.1 Storage Abstraction

```python
ImageStorageService (interface)
├── upload(file, folder) → returns url/path
├── delete(url) → removes image
├── get_url(path, size) → returns sized URL

LocalStorageAdapter (development)
├── Saves to backend/static/uploads/{folder}/{uuid}.{ext}
├── Serves via FastAPI static files route
├── Resizing using Pillow (thumbnail, medium, large)

CloudinaryAdapter (production - future)
├── Same interface, uploads to Cloudinary
├── Uses Cloudinary transformations for resizing
```

### 2.2 Image Processing Rules

**Events:**
- Aspect ratio: 16:9 (enforced via frontend crop)
- Sizes: thumbnail (320x180), medium (640x360), large (1280x720)
- Fallback: default placeholder image
- Validation: max 5MB, JPEG/PNG/WebP only

**Venues:**
- Aspect ratio: 16:9
- Same size variants as events
- Fallback: default venue placeholder

**Categories:**
- Aspect ratio: flexible (CSS handles display)
- Single size stored
- Required for visual grid

### 2.3 Media API Endpoints

```
POST /api/media/upload?folder={events|venues|categories}
  - Accepts multipart form data
  - Validates file type and size
  - Generates size variants
  - Returns { url, thumbnail_url, medium_url }

DELETE /api/media/{path}
  - Removes image and all variants
  - Admin or resource owner only
```

---

## 3. Geocoding & Maps

### 3.1 Geocoding Flow

```
1. User enters address in form
2. Frontend debounces input (300ms)
3. Calls backend proxy to Mapbox Geocoding API
4. User selects address from suggestions
5. lat, lng, formatted_address populated automatically
6. Backend validates coordinates within Highland region on save
```

### 3.2 Geocoding Service

```python
MapboxGeocodingService
├── search(query) → list of suggestions with coords
├── reverse_geocode(lat, lng) → formatted address
├── validate_highland_region(lat, lng) → bool

Config:
├── MAPBOX_ACCESS_TOKEN in .env
├── Highland region bounding box for validation
```

### 3.3 Map Embeds

- Static map image via Mapbox Static Images API
- Displayed on event and venue detail pages
- Collapsible on mobile (default collapsed)
- "Get Directions" link to Google Maps/Apple Maps

### 3.4 Distance Search

```
GET /api/events?lat=57.48&lng=-4.22&distance=10

Distance options: 5, 10, 20, 50 (km)
├── Uses existing Haversine calculation
├── Filter shown only when user location available
```

---

## 4. API Endpoints

### 4.1 Category Endpoints

```
GET    /api/categories           - List all active categories (public)
POST   /api/categories           - Create category (admin only)
GET    /api/categories/{id}      - Get category by ID or slug (public)
PUT    /api/categories/{id}      - Update category (admin only)
DELETE /api/categories/{id}      - Delete category (admin only, fails if events exist)
```

### 4.2 Tag Endpoints

```
GET    /api/tags                 - List tags (supports ?search= for autocomplete)
GET    /api/tags/popular         - Top 20 tags by usage_count
POST   /api/events/{id}/tags     - Add tags to event (event owner, max 5 total)
DELETE /api/events/{id}/tags/{tag_id} - Remove tag from event (event owner)
```

### 4.3 Updated Event Endpoints

```
GET /api/events
  - New filters: category_id, tags (comma-separated slugs), distance
  - Returns category object and tags array with each event

POST /api/events
  - Requires category_id (UUID)
  - Accepts tags array (strings, auto-creates new tags)
  - Accepts image_url or image file upload

PUT /api/events/{id}
  - Same as POST for category, tags, image
```

### 4.4 Updated Venue Endpoints

```
POST /api/venues
PUT /api/venues/{id}
  - Address triggers geocoding suggestion lookup
  - Stores formatted_address, lat, lng from selection
  - Accepts image_url or image file upload
```

### 4.5 Geocoding Proxy Endpoint

```
GET /api/geocode/search?q={query}
  - Proxies to Mapbox Geocoding API
  - Returns list of suggestions with coordinates
  - Keeps API token server-side
```

---

## 5. Frontend Components

### 5.1 Homepage Updates

**Category Grid:**
- Responsive grid: 2 cols mobile, 4 cols desktop
- Each card: background image + gradient overlay + title at bottom
- Click navigates to `/events?category={slug}`
- Position: below hero, above featured events

**Popular Tags Cloud:**
- Horizontal scrollable or wrapped layout
- Top 15-20 tags as clickable pills
- Click navigates to `/events?tags={tag-name}`
- Position: explore page or below category grid

### 5.2 Form Components

**Category Select:**
- Required dropdown from /api/categories
- Shows category name with colour indicator dot

**Tag Input:**
- Autocomplete input fetching /api/tags?search=
- Selected tags as removable pills
- Max 5 tags with validation message
- Enter creates new tag if not found

**Image Upload:**
- Drag-and-drop zone or click to browse
- Preview with 16:9 crop tool
- Upload progress indicator
- Current image display with "Remove" option

**Address Autocomplete:**
- Input with debounced Mapbox suggestions
- Dropdown of matching addresses
- Selection populates lat, lng, formatted_address

### 5.3 Detail Page Updates

**Event Page:**
- Full-width hero image (16:9) with fallback
- Tags as clickable pills below title
- Static map embed (collapsible on mobile)
- "Get Directions" button

**Venue Page:**
- Featured image header with fallback
- Static map embed (collapsible on mobile)
- "Get Directions" button

### 5.4 Filter Updates

**Event List Filters:**
- Category: multi-select dropdown
- Tags: autocomplete multi-select
- Distance: dropdown (5km, 10km, 20km, 50km) - shown if location available
- Existing filters retained: date range, price range

---

## 6. Migration Strategy

### 6.1 Database Migration Steps

```
Step 1: Create new tables
├── Category table
├── Tag table
├── EventTag junction table

Step 2: Seed default categories
├── Music, Festival, Community, Food & Drink, Sports,
│   Arts & Culture, Family, Nightlife, Markets, Outdoor, Tours, Other
├── Each with placeholder image and gradient colour

Step 3: Update Event table
├── Add category_id column (nullable initially)
├── Add image_url column
├── Map existing category strings to new Category IDs
├── Make category_id required
├── Drop old category string column

Step 4: Update Venue table
├── Add image_url column
├── Add formatted_address column
```

### 6.2 Default Categories

| Name | Slug | Gradient Colour |
|------|------|-----------------|
| Music | music | #8B5CF6 (purple) |
| Festival | festival | #F59E0B (amber) |
| Community | community | #10B981 (emerald) |
| Food & Drink | food-drink | #EF4444 (red) |
| Sports | sports | #3B82F6 (blue) |
| Arts & Culture | arts-culture | #EC4899 (pink) |
| Family | family | #14B8A6 (teal) |
| Nightlife | nightlife | #6366F1 (indigo) |
| Markets | markets | #F97316 (orange) |
| Outdoor | outdoor | #22C55E (green) |
| Tours | tours | #0EA5E9 (sky) |
| Other | other | #6B7280 (gray) |

---

## 7. Implementation Order

### Backend (Steps 1-8)

1. Category model, schema, CRUD endpoints
2. Migration script (create categories from existing strings)
3. Tag model, schema, endpoints
4. Media upload service (local storage adapter)
5. Update Event model (category_id FK, image_url, tags relationship)
6. Update Venue model (image_url, formatted_address)
7. Mapbox geocoding service + proxy endpoint
8. Update event/venue endpoints with new fields + filters

### Frontend (Steps 9-17)

9. Category grid component for homepage
10. Tag input component with autocomplete
11. Image upload component with 16:9 crop
12. Address autocomplete component (Mapbox)
13. Update event create/edit forms
14. Update venue create/edit forms
15. Update event/venue detail pages (images, maps, tags)
16. Update event list filters (category, tags, distance)
17. Popular tags cloud component

### Admin & Data (Steps 18-19)

18. Category management page (admin CRUD interface)
19. Seed default categories with placeholder images

---

## 8. File Changes Summary

### Backend New Files
- `backend/app/models/category.py`
- `backend/app/models/tag.py`
- `backend/app/schemas/category.py`
- `backend/app/schemas/tag.py`
- `backend/app/api/categories.py`
- `backend/app/api/tags.py`
- `backend/app/api/media.py`
- `backend/app/api/geocode.py`
- `backend/app/services/media.py`
- `backend/app/services/geocoding.py`

### Backend Modified Files
- `backend/app/models/event.py`
- `backend/app/models/venue.py`
- `backend/app/schemas/event.py`
- `backend/app/schemas/venue.py`
- `backend/app/api/events.py`
- `backend/app/api/venues.py`
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/seeds/seed_data.py`

### Frontend New Files
- `frontend/src/components/categories/CategoryGrid.tsx`
- `frontend/src/components/tags/TagInput.tsx`
- `frontend/src/components/tags/TagCloud.tsx`
- `frontend/src/components/common/ImageUpload.tsx`
- `frontend/src/components/common/AddressAutocomplete.tsx`
- `frontend/src/components/common/StaticMap.tsx`
- `frontend/src/pages/admin/categories.tsx`

### Frontend Modified Files
- `frontend/src/pages/index.tsx`
- `frontend/src/pages/events/index.tsx`
- `frontend/src/pages/events/[id].tsx`
- `frontend/src/pages/venues/[id].tsx`
- `frontend/src/pages/submit-event.tsx`
- `frontend/src/components/events/EventCard.tsx`
- `frontend/src/components/events/EventFilters.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/types/index.ts`

---

## 9. Configuration Required

### Environment Variables

```env
# Backend (.env)
MAPBOX_ACCESS_TOKEN=pk.xxx
MEDIA_STORAGE=local  # or 'cloudinary' for production
UPLOAD_DIR=static/uploads

# Frontend (.env.local)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
```

---

## 10. Success Criteria

- [ ] Categories display as visual grid on homepage
- [ ] Events can be filtered by category (single and multiple)
- [ ] Event creators can add up to 5 tags per event
- [ ] Tag autocomplete suggests existing tags
- [ ] Popular tags cloud displays on explore/home page
- [ ] Events and venues support image upload with 16:9 enforcement
- [ ] Address autocomplete works with Mapbox suggestions
- [ ] Static maps display on event/venue detail pages
- [ ] Distance-based filtering works when user location available
- [ ] Admin can CRUD categories via admin interface
- [ ] Existing events migrated to new category system
