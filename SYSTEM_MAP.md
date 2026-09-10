# SYSTEM_MAP.md — Highland Events Hub

For the documentation entrypoint and the relationship between this map and the authoritative project context, see [docs/architecture/index.md](docs/architecture/index.md).

## Data Validation Rules

### Flexible URL Validation (ticket_url, website_url, image_url)

**Purpose:** Allow users to enter URLs without requiring an explicit `https://` protocol prefix.

**Frontend Behaviour:**
- URL input fields use `type="text"` (not `type="url"`) to avoid browser-native strict validation.
- An `onBlur` handler auto-prepends `https://` when the user tabs or clicks away, if no protocol is present.
- Utility functions located in `frontend/src/utils/url.ts`:
  - `normalizeUrl(value)` – Trims whitespace, returns empty for blanks, prepends `https://` if missing.
  - `createUrlBlurHandler(setFormData, fieldName)` – Factory for blur event handlers.

**Backend Behaviour:**
- Pydantic schemas `EventCreate` and `EventUpdate` in `backend/app/schemas/event.py` use a `@model_validator(mode='before')` that runs `_sanitize_url()` on `ticket_url`, `website_url`, and `image_url` before validation.
- `_sanitize_url()` trims whitespace, converts empty/whitespace-only strings to `None`, and prepends `https://` to values missing a protocol.
- The underlying field types remain `Optional[str]` (not `HttpUrl` or `AnyHttpUrl`).

**Affected Files:**
| Layer | File | What Changed |
|-------|------|-------------|
| Frontend Utility | `frontend/src/utils/url.ts` | Shared URL normalization helpers |
| Unified Create/Edit Wizard | `frontend/src/components/events/wizard/StepReview.tsx` | Normalizes `ticket_url` and `website_url` on blur for the current wizard |
| Frontend Create Route | `frontend/src/pages/submit-event.tsx` | Renders `EventWizardForm` in creation mode |
| Frontend Edit Route | `frontend/src/pages/events/[id]/edit.tsx` | Renders the same `EventWizardForm` in edit mode |
| Frontend Showtimes | `frontend/src/components/events/form-sections/EventScheduleSection.tsx` | Normalizes per-showtime `ticket_url`; used by the wizard timeline step |
| Backend Schema | `backend/app/schemas/event.py` | `_sanitize_url()` helper + `@model_validator` on `EventCreate` and `EventUpdate` |

> [!NOTE]
> This is **not** a security vulnerability — the backend sanitizer acts as a defence-in-depth measure ensuring all URLs stored in the database have a valid protocol, regardless of what the frontend sends.

---

## Scraper Data Sources

The scraper paths in this section belong to the separate, manually operated scraper project and are not present in this application repository. This repository retains the typed ingestion and administrative import boundaries only.

### The Victorian Market (Inverness)

**Source File:** `HEH/scrapers/victorian_market/thevictorianmarket-co-uk-2026-02-15.xlsx`
**Scraper File:** `HEH/scrapers/victorian_market/vm_scrape.py`
**Entry Point:** `scrape(hm)` — called from `HEH/scrapers/main.py` (menu option 6)

**Architecture:**
- **PIVOT**: Due to aggressive Cloudflare WAF protection preventing automated scraping, this source now uses a **manual export workflow**.
- The user exports the event list using a browser plugin (e.g., Web Scraper) to an Excel file.
- The scraper uses `pandas` and `openpyxl` to parse the Excel data.

**Data Mapping:**
- **Title**: Extracted from column `data`, with "Live Music | " prefix stripped.
- **Date/Time**: Combines columns `data2` (Date) and `data6` (Time range) into ISO 8601.
- **Description**: Merges `Event_Description` columns.
- **Image**: Extracted from column `image`.

**Historical Tracking:** Uses `HistoryManager` with keys derived from the `item_page_link` column.

| Key | Details |
|-----|---------|
| Source Name | `The Victorian Market` |
| Venue Name | `The Victorian Market, Inverness` |
| Method | Excel Parsing (Pandas) |
| File Required | `thevictorianmarket-co-uk-2026-02-15.xlsx` |
