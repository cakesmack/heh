/**
 * Image Optimizer Utility
 * Standardizes Cloudinary URL transformations to reduce bandwidth.
 */

/**
 * Optimizes an image URL or ID by injecting transformation parameters.
 * Supports both Cloudinary URLs and Cloudflare Image IDs.
 * 
 * @param urlOrId - The original image URL or Cloudflare Image ID
 * @param options - Transformation options (width or variant)
 * @returns The optimized image URL
 */
export function optimizeImage(
    urlOrId: string | null | undefined,
    options: number | 'thumb' | 'hero' = 'hero'
): string {
    if (!urlOrId) return '';

    let width = typeof options === 'number' ? options : 1200;
    let variant: 'public' | 'thumbnail' | 'hero' = 'public';

    if (options === 'thumb') {
        width = 400;
        variant = 'public'; // Using public for now as standard, but mapping exists
    } else if (options === 'hero') {
        width = 1600;
        variant = 'public';
    }

    let cleanUrlOrId = urlOrId.trim();

    // If it's a data URL (local preview), return as is
    if (cleanUrlOrId.startsWith('data:')) {
        return cleanUrlOrId;
    }

    // If it's a local static path, return as is
    if (cleanUrlOrId.startsWith('/')) {
        return cleanUrlOrId;
    }

    // SELF-HEALING: If it's a Cloudflare ID that got corrupted with 'https://' by the backend sanitizer
    // Example: https://5ed3e706-cbf4-46be-b0c9-3e89f7d7da00/
    if (cleanUrlOrId.startsWith('https://')) {
        // Strip protocol and any trailing slashes to see if what's left is a Cloudflare ID (UUID)
        const stripped = cleanUrlOrId.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

        // Cloudflare IDs are UUIDs (36 chars with 4 hyphens)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stripped);

        if (isUuid) {
            cleanUrlOrId = stripped;
        } else if (cleanUrlOrId.startsWith('https:///')) {
            // Handle accidental triple slashes
            cleanUrlOrId = cleanUrlOrId.replace('https:///', '').replace(/\/+$/, '');
        }
    }

    // Handle Cloudinary URLs
    if (cleanUrlOrId.includes('res.cloudinary.com')) {
        // Check if it's an upload URL and doesn't already have transformations
        if (cleanUrlOrId.includes('/upload/') && !cleanUrlOrId.includes('/upload/f_auto') && !cleanUrlOrId.includes('/upload/w_')) {
            const params = `f_auto,q_auto,c_limit,w_${width}`;
            return cleanUrlOrId.replace('/upload/', `/upload/${params}/`);
        }
        return cleanUrlOrId;
    }

    // Handle Cloudflare Image IDs (assuming anything else is an ID)
    // Format: https://imagedelivery.net/{ACCOUNT_HASH}/{ID}/{VARIANT}
    const hash = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_HASH || process.env.CLOUDFLARE_ACCOUNT_HASH;

    if (!cleanUrlOrId.startsWith('http')) {
        if (!hash) {
            console.warn('[imageOptimizer] Account Hash missing. Cannot construct Cloudflare URL for:', cleanUrlOrId);
            return '';
        }

        // Map internal variants to Cloudflare variant names
        // Note: Reverted to 'public' default due to user feedback on missing variants,
        // but keeping the structure for future expansion.
        const cfVariant = 'public';

        return `https://imagedelivery.net/${hash}/${cleanUrlOrId}/${cfVariant}`;
    }

    return cleanUrlOrId;
}
