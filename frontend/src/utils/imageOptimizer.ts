/**
 * Image Optimizer Utility
 * Standardizes Cloudinary URL transformations to reduce bandwidth.
 */

/**
 * Optimizes a Cloudinary image URL by injecting transformation parameters.
 * 
 * @param url - The original image URL
 * @param width - The desired width in pixels
 * @returns The optimized Cloudinary URL or original URL if not Cloudinary
 */
export function optimizeCloudinaryUrl(url: string | null | undefined, width: number): string {
    if (!url) return '';

    // Only optimize Cloudinary URLs
    if (!url.includes('res.cloudinary.com')) {
        return url;
    }

    // Check if it's an upload URL and doesn't already have transformations
    if (url.includes('/upload/') && !url.includes('/upload/f_auto') && !url.includes('/upload/w_')) {
        // f_auto: Auto format (WebP/AVIF)
        // q_auto: Intelligent quality compression
        // c_limit: Resize if larger, but don't upscale
        // w_{width}: Set target width
        const params = `f_auto,q_auto,c_limit,w_${width}`;
        return url.replace('/upload/', `/upload/${params}/`);
    }

    return url;
}
