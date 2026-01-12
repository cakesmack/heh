/**
 * Image Optimization Utilities
 * Handles Cloudinary transformations and other image helpers.
 */

/**
 * Optimizes a Cloudinary image URL by injecting transformation parameters.
 * 
 * @param url - The original image URL
 * @param width - The desired width in pixels
 * @returns The optimized Cloudinary URL or original URL if not Cloudinary
 */
export function getOptimizedImage(url: string, width: number): string {
    if (!url) return '';

    // Only optimize Cloudinary URLs
    if (!url.includes('cloudinary.com')) {
        return url;
    }

    // Check if parameters already exist (basic check to avoid double injection)
    // We look for the '/upload/' segment which is standard in Cloudinary URLs
    if (url.includes('/upload/') && !url.includes('/upload/f_auto')) {
        // Inject params:
        // f_auto: Auto format (WebP/AVIF)
        // q_auto: Auto quality
        // w_{width}: Resize to width
        // c_limit: Limit size (don't upscale)
        const params = `f_auto,q_auto,w_${width},c_limit`;
        return url.replace('/upload/', `/upload/${params}/`);
    }

    return url;
}
