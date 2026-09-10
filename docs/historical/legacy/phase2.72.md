Phase 2.71: The Map & Geofence Update
Project: Highland Events Hub Focus: Strictly Map features, Location Validation, and Mobile Map UX.

🛡️ Sprint 1: The HIE Geofence (Validator)
Goal: Restrict venue creation to the official Highlands & Islands Enterprise region using strict postcode logic.

1. The Validation Utility (utils/validation/hie-check.ts)
Create Function: isHIERegion(postcode: string): boolean

The Rules (HIE Definition):

Allow All: Prefixes IV, HS, KW, ZE.

PH (Perth/Highland): Allow Districts 19 - 50 (e.g., Aviemore/Pitlochry).

PA (Argyll/Isles): Allow Districts 20 - 78 (e.g., Oban/Mull).

AB (Moray/Speyside): Allow Districts 37, 38, 44, 45, 51-56.

KA (Islands): Allow Districts 27 (Arran) and 28 (Cumbrae).

Logic:

Normalize string (remove spaces, uppercase).

Extract Prefix (letters) and District (numbers).

Compare against allowlist.

2. Form Integration
Component: VenueForm (Create & Edit).

Action:

Trigger on postcode field blur or Mapbox Geocoder selection.

Run isHIERegion(value).

If Invalid: Show error "Venue must be located in the Highlands & Islands region" and disable the Submit button.

🗺️ Sprint 2: Interactive Map Regions
Goal: Allow users to filter the map by clicking on visual areas (e.g., "Skye", "Moray").

1. The Data Source (regions.geojson)
Action: Create a GeoJSON file with polygons for your key tourist areas.

Suggested Areas:

Inverness & Loch Ness

Cairngorms & Moray

Fort William & Lochaber

Skye & Wester Ross

North Highlands (NC500)

Argyll & The Isles

Orkney / Shetland / Hebrides

File Location: public/data/regions.geojson.

2. Map Implementation
Library: Install @turf/turf (for checking "Points Inside Polygon").

Layer: Add the GeoJSON as a fill layer.

Default: Transparent (opacity: 0).

Hover: Light border or tint to indicate clickability.

Interaction:

On Click:

Get the Polygon geometry of the clicked shape.

Use turf.pointsWithinPolygon(events, polygon) to find matching Event IDs.

Apply a Mapbox Filter: ['in', 'id', ...matchingIds].

Zoom map to fit the region bounds.

📱 Sprint 3: Mobile Map Experience
Goal: Fix the clunky mobile map interaction.

1. Map Load State
Change: On Mobile, load the Full Screen Map by default (instead of the List).

Toggle: Add a floating "List View" button (bottom-right) to switch back to the cards.

2. The "Bottom Sheet" Modal
Current Behavior: Clicking a pin does nothing or acts weirdly.

New Behavior: Clicking a pin opens a Slide-Up Drawer (Bottom Sheet).

Content:

Left: Event Image (Square thumbnail).

Right: Title, Date, Venue Name.

Bottom: "View Details" Button (Links to Event Page).

UX: Clicking the map background closes the drawer.