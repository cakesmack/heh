# Phase 3.1: Google Maps Migration Design

**Date:** 2025-12-29
**Status:** Approved
**Objective:** Replace Mapbox with Google Maps Platform across the entire app.

---

## 1. Architecture Overview

### Library Choice
**Selected:** `@vis.gl/react-google-maps` (Official Google-recommended)

Reasons:
- Native `<AdvancedMarker>` component for custom HTML/CSS pins
- Modern hooks-first React patterns
- Excellent TypeScript support
- Optimized bundle size

### Migration Strategy

| Phase | Description |
|-------|-------------|
| 1 | Backend: Enhance distance filtering with true Haversine |
| 2 | Frontend: Add GoogleMapsProvider at app root |
| 3 | Frontend: Create new Google Maps components |
| 4 | Frontend: Swap imports and remove Mapbox |

---

## 2. Backend Changes

### File: `backend/app/api/events.py`

**Current:** Bounding box filter only (square, imprecise)

**Enhanced:**
1. Keep bounding box as first-pass SQL filter (efficient)
2. Post-filter with true Haversine distance calculation
3. Sort results by distance (nearest first)

```python
# After DB query, refine with true distance
if radius_km is not None and latitude is not None and longitude is not None:
    events_with_distance = []
    for event in events:
        if event.latitude and event.longitude:
            dist = haversine_distance(latitude, longitude, event.latitude, event.longitude)
            if dist <= radius_km:
                events_with_distance.append((event, dist))

    # Sort by distance
    events_with_distance.sort(key=lambda x: x[1])
    events = [e[0] for e in events_with_distance]
```

**API Contract:** No breaking changes - same query params, enhanced behavior.

---

## 3. Frontend Components

### 3.1 GoogleMapsProvider

**Location:** `src/pages/_app.tsx`

Wraps app with `<APIProvider>` to load Google Maps script once.

```tsx
import { APIProvider } from '@vis.gl/react-google-maps';

<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}>
  <Component {...pageProps} />
</APIProvider>
```

### 3.2 PlacesAutocomplete

**Location:** `src/components/maps/PlacesAutocomplete.tsx`

**Props:**
```typescript
interface PlacesAutocompleteProps {
  onSelect: (place: {
    address: string;
    postcode: string;
    latitude: number;
    longitude: number;
    placeId: string;
  }) => void;
  defaultValue?: string;
  placeholder?: string;
}
```

**Features:**
- Debounced input (300ms)
- UK-restricted results
- Extracts postcode from address components
- HIE validation via existing `isHIERegion()` util

### 3.3 GoogleMapView

**Location:** `src/components/events/GoogleMapView.tsx`

**Props:** Same interface as current `MapView.tsx` (drop-in replacement)

**Category Marker Colors:**
| Category | Color | Icon |
|----------|-------|------|
| Music | #EF4444 (red) | Musical note |
| Food & Drink | #F59E0B (amber) | Utensils |
| Sports | #10B981 (green) | Ball |
| Arts | #8B5CF6 (purple) | Palette |
| Community | #3B82F6 (blue) | People |
| Default | #6B7280 (gray) | Pin |

**Performance Optimizations:**
- `useMemo` for marker data arrays
- `useCallback` for click handlers
- Stable key props for markers

### 3.4 GoogleMiniMap

**Location:** `src/components/maps/GoogleMiniMap.tsx`

**Props:** Same as current `MiniMap.tsx`
- `latitude`, `longitude`, `zoom`, `height`
- `showMarker`, `interactive`, `markerColor`

---

## 4. Migration Steps

| Step | Action | Files |
|------|--------|-------|
| 1 | Backend: Add true Haversine filtering | `backend/app/api/events.py` |
| 2 | Install @vis.gl/react-google-maps | `frontend/package.json` |
| 3 | Add APIProvider to _app.tsx | `frontend/src/pages/_app.tsx` |
| 4 | Create PlacesAutocomplete | `frontend/src/components/maps/PlacesAutocomplete.tsx` |
| 5 | Create GoogleMiniMap | `frontend/src/components/maps/GoogleMiniMap.tsx` |
| 6 | Create GoogleMapView | `frontend/src/components/events/GoogleMapView.tsx` |
| 7 | Update venues/new.tsx | `frontend/src/pages/venues/new.tsx` |
| 8 | Swap MapView imports across app | Multiple files |
| 9 | Uninstall Mapbox packages | `frontend/package.json` |
| 10 | Delete old Mapbox components | 3 files |

---

## 5. Environment Variables

```env
# Remove (after migration complete)
NEXT_PUBLIC_MAPBOX_TOKEN=xxx

# Required (already exists)
NEXT_PUBLIC_GOOGLE_MAPS_KEY=xxx
```

**Required Google Cloud APIs:**
- Maps JavaScript API
- Places API

---

## 6. Files to Delete (After Verification)

- `src/components/events/MapView.tsx`
- `src/components/maps/MiniMap.tsx`
- `src/components/admin/PostcodeLookup.tsx`

---

## 7. Testing Checklist

- [ ] PlacesAutocomplete returns accurate coordinates
- [ ] HIE region validation still works
- [ ] GoogleMiniMap renders correctly on venue pages
- [ ] GoogleMapView displays all events with category markers
- [ ] Marker click opens correct popup
- [ ] "Near Me" filtering returns distance-sorted results
- [ ] No console errors about missing Mapbox token
- [ ] Bundle size reduced after Mapbox removal
