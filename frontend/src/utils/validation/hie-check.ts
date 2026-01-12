/**
 * HIE Region Postcode Validator
 * Restricts venue creation to the official Highlands & Islands Enterprise region.
 */

export function isHIERegion(postcode: string): boolean {
    if (!postcode) return false;

    // 1. Clean and Isolate Outward Code
    // We want the "Area" and "District" (e.g., "PH22").
    // UK Postcodes are usually "Outward Inward" (e.g., "PH22 1RH").
    const upper = postcode.toUpperCase().trim();
    let outwardCode = '';

    if (upper.includes(' ')) {
        // Best case: User/Google provided a space. "PH22 1RH" -> "PH22"
        outwardCode = upper.split(' ')[0];
    } else {
        // Fallback: No space. "PH221RH".
        // The "Inward Code" is always the last 3 chars (Digit, Letter, Letter).
        // If length > 3, we slice off the last 3.
        // If length <= 4 (e.g., "IV1"), it might just be the outward code being typed.
        if (upper.length > 4) {
            outwardCode = upper.slice(0, -3);
        } else {
            outwardCode = upper;
        }
    }

    // 2. Parse Area and District
    // Matches: "PH" (Area) and "22" (District) from "PH22"
    const match = outwardCode.match(/^([A-Z]{1,2})(\d{1,2})/);
    if (!match) return false;

    const prefix = match[1]; // e.g., "PH"
    const district = parseInt(match[2], 10); // e.g., 22

    // 3. Validation Logic (Strict List)

    // Group 1: Whole Areas
    // IV (Inverness), KW (Wick/Thurso), HS (Hebrides), ZE (Shetland)
    const allowedAll = ['IV', 'HS', 'KW', 'ZE'];
    if (allowedAll.includes(prefix)) {
        return true;
    }

    // Group 2: PH (Perth/Highlands)
    // Allowed: PH19-26, PH30-41
    if (prefix === 'PH') {
        if (district >= 19 && district <= 26) return true;
        if (district >= 30 && district <= 41) return true;
        return false;
    }

    // Group 3: PA (Argyll/Isles)
    // Allowed: PA20-78 (Includes PA20-40 and PA41-78)
    if (prefix === 'PA') {
        return district >= 20 && district <= 78;
    }

    // Group 4: KA (Arran/Cumbrae)
    // Allowed: KA27 only (Arran)
    // Note: User prompt "Optional: KA27". Including it as requested.
    if (prefix === 'KA') {
        return district === 27;
    }

    return false;
}

/**
 * Coordinate-based Highland region check.
 * Used as fallback when postcode is not available (e.g., landmarks).
 * 
 * Bounding box roughly covers:
 * - North: Cape Wrath area (~58.6°N)
 * - South: Fort William / Oban area (~56.3°N)
 * - West: Outer Hebrides (~-7.5°W)
 * - East: Moray / Speyside (~-3.0°E)
 */
export function isPointInHighlands(lat: number, lng: number): boolean {
    // Scottish Highlands & Islands bounding box
    const MIN_LAT = 56.3;   // Southern boundary (around Oban/Fort William)
    const MAX_LAT = 58.7;   // Northern boundary (Cape Wrath)
    const MIN_LNG = -7.7;   // Western boundary (Outer Hebrides)
    const MAX_LNG = -3.0;   // Eastern boundary (Moray coast)

    return lat >= MIN_LAT && lat <= MAX_LAT && lng >= MIN_LNG && lng <= MAX_LNG;
}
