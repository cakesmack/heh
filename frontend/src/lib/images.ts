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

    // Check if parameters already exist to avoid breaking existing transforms
    // We check for 'f_auto' or 'w_' which indicate existing params
    if (url.includes('/upload/') && !url.includes('/upload/f_auto') && !url.includes('/upload/w_')) {
        // Inject params:
        // f_auto: Auto format (WebP/AVIF)
        // q_auto: Auto quality
        // w_{width}: Resize to width
        // Note: Removed c_limit to ensure images fill the requested width (upscaling if necessary)
        // helping to avoid "small image in big container" layout shifts/gaps, 
        // though native resolution is always best.
        const params = `f_auto,q_auto,w_${width}`;
        return url.replace('/upload/', `/upload/${params}/`);
    }

    return url;
}
