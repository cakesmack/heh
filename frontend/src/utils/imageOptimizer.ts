/**
 * Image Optimizer Utility
 * Standardizes Cloudinary URL transformations to reduce bandwidth.
 */

/**
 * Optimizes an image URL by injecting transformation parameters.
 * Supports both Cloudinary URLs and Cloudflare Image IDs.
 * 
 * @param urlOrId - The original image URL or Cloudflare Image ID
 * @param width - The desired width in pixels
 * @returns The optimized image URL
 */
export function optimizeCloudinaryUrl(urlOrId: string | null | undefined, width: number): string {
    if (!urlOrId) return '';

    let cleanUrlOrId = urlOrId.trim();

    // If it's a data URL (local preview), return as is
    if (cleanUrlOrId.startsWith('data:')) {
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
            // Return empty string to avoid relative path 404s
            return '';
        }

        // Align with backend variants defined in media.py / cloudflare_service.py
        let variant = 'card'; // Default to card
        if (width <= 200) variant = 'thumbnail';
        else if (width >= 1200) variant = 'hero';

        return `https://imagedelivery.net/${hash}/${cleanUrlOrId}/${variant}`;
    }

    return cleanUrlOrId;
}
