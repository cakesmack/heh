/**
 * String utility functions
 */

/**
 * Strips HTML tags from a string.
 * @param html The string containing HTML tags.
 * @returns The string with plain text only.
 */
export function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
}
