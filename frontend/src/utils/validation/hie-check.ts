/**
 * HIE Region Postcode Validator
 * Restricts venue creation to the official Highlands & Islands Enterprise region.
 */

export function isHIERegion(postcode: string): boolean {
    if (!postcode) return false;

    // Normalize: remove spaces and uppercase
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();

    // Extract prefix (letters) and district (first set of numbers)
    // Example: IV1 1AA -> IV1 -> Prefix: IV, District: 1
    // Example: PH33 6SA -> PH33 -> Prefix: PH, District: 33
    // Example: ZE1 0AA -> ZE1 -> Prefix: ZE, District: 1

    const match = cleanPostcode.match(/^([A-Z]{1,2})(\d+)/);
    if (!match) return false;

    const prefix = match[1];
    const district = parseInt(match[2], 10);

    // 1. Allow All: Prefixes IV, HS, KW, ZE
    const allowedPrefixes = ['IV', 'HS', 'KW', 'ZE'];
    if (allowedPrefixes.includes(prefix)) {
        return true;
    }

    // 2. PH (Perth/Highland): Allow Districts 19 - 50
    if (prefix === 'PH') {
        return district >= 19 && district <= 50;
    }

    // 3. PA (Argyll/Isles): Allow Districts 20 - 78
    if (prefix === 'PA') {
        return district >= 20 && district <= 78;
    }

    // 4. AB (Moray/Speyside): Allow Districts 37, 38, 44, 45, 51-56
    if (prefix === 'AB') {
        const allowedAB = [37, 38, 44, 45, 51, 52, 53, 54, 55, 56];
        return allowedAB.includes(district);
    }

    // 5. KA (Islands): Allow Districts 27 (Arran) and 28 (Cumbrae)
    if (prefix === 'KA') {
        return district === 27 || district === 28;
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
