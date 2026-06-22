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
    options: number | 'thumb' | 'hero' | 'card' = 'hero'
): string {
    if (!urlOrId) return '';

    let width = typeof options === 'number' ? options : 1200;
    let variant: 'public' | 'thumbnail' | 'hero' = 'public';

    if (options === 'thumb') {
        width = 400;
        variant = 'public'; // Using public for now as standard, but mapping exists
    } else if (options === 'card') {
        width = 800;
        variant = 'public';
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

    // SELF-HEALING: If it's a Cloudflare ID that got corrupted with 'https://' or 'http://' by the backend sanitizer
    // Example: https://5ed3e706-cbf4-46be-b0c9-3e89f7d7da00/
    if (cleanUrlOrId.startsWith('https://') || cleanUrlOrId.startsWith('http://')) {
        // Extract just the UUID part - Cloudflare IDs are standard UUIDs
        const uuidMatch = cleanUrlOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

        if (uuidMatch) {
            cleanUrlOrId = uuidMatch[0];
        } else if (cleanUrlOrId.includes(':////')) {
            // Handle accidental triple/quad slashes if no UUID matched
            cleanUrlOrId = cleanUrlOrId.replace(/^https?:\/\/+/i, '').replace(/\/+$/, '');
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
            console.warn('[imageOptimizer] Account Hash missing. Cannot construct Cloudflare URL for:', cleanUrlOrId, {
                env: process.env.NODE_ENV,
                has_public: !!process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_HASH,
                has_secret: !!process.env.CLOUDFLARE_ACCOUNT_HASH
            });
            return '';
        }

        // Map internal variants to Cloudflare variant names
        let cfVariant = 'hero'; // Default high-res

        if (options === 'thumb') {
            cfVariant = 'thumbnail';
        } else if (options === 'hero' || options === 'card') {
            cfVariant = 'hero';
        } else if (typeof options === 'number' && options <= 150) {
            cfVariant = 'thumbnail'; // Handle number case if strictly small
        } else if (typeof options === 'number') {
            cfVariant = 'public';
        }

        return `https://imagedelivery.net/${hash}/${cleanUrlOrId}/${cfVariant}`;
    }

    return cleanUrlOrId;
}
