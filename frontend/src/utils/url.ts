/**
 * URL Utilities
 * Flexible URL handling: auto-prepends https:// for user-friendly input
 */

/**
 * Normalizes a URL string by prepending https:// if no protocol is present.
 * Returns empty string for blank/whitespace-only input.
 *
 * Examples:
 *   "www.google.com"        → "https://www.google.com"
 *   "eventbrite.co.uk/foo"  → "https://eventbrite.co.uk/foo"
 *   "https://example.com"   → "https://example.com" (unchanged)
 *   "http://example.com"    → "http://example.com"  (unchanged)
 *   ""                      → ""
 *   "   "                   → ""
 */
export function normalizeUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    // Already has a protocol — leave it alone
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    // Prepend https://
    return `https://${trimmed}`;
}

/**
 * onBlur handler factory for URL input fields.
 * Normalizes the value in-place when the user leaves the field.
 */
export function createUrlBlurHandler(
    setFormData: React.Dispatch<React.SetStateAction<any>>,
    fieldName: string
) {
    return () => {
        setFormData((prev: any) => ({
            ...prev,
            [fieldName]: normalizeUrl(prev[fieldName] || ''),
        }));
    };
}
