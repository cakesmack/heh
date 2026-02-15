# SYSTEM_MAP.md — Highland Events Hub

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
| Frontend Utility | `src/utils/url.ts` | New shared URL normalization helpers |
| Frontend Create | `src/components/events/form-sections/EventTicketingSection.tsx` | `type="text"`, blur handlers, `setFormData` prop |
| Frontend Create | `src/pages/submit-event.tsx` | Passes `setFormData` to `EventTicketingSection` |
| Frontend Edit | `src/pages/events/[id]/edit.tsx` | `type="text"`, blur handler on ticket_url |
| Frontend Showtimes | `src/components/events/form-sections/EventScheduleSection.tsx` | Showtime ticket_url: `type="text"` + blur normalization |
| Backend Schema | `backend/app/schemas/event.py` | `_sanitize_url()` helper + `@model_validator` on `EventCreate` and `EventUpdate` |

> [!NOTE]
> This is **not** a security vulnerability — the backend sanitizer acts as a defence-in-depth measure ensuring all URLs stored in the database have a valid protocol, regardless of what the frontend sends.

---

## Scraper Data Sources

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
