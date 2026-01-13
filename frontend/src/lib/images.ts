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
/**
 * Optimizes a Cloudinary image URL by injecting transformation parameters.
 * 
 * @param url - The original image URL
 * @param width - The desired width in pixels (1x)
 * @param height - Optional desired height in pixels (1x)
 * @returns The optimized Cloudinary URL or original URL if not Cloudinary
 */
export function getOptimizedImage(url: string, width: number, height?: number): string {
    if (!url) return '';

    // Only optimize Cloudinary URLs
    if (!url.includes('cloudinary.com')) {
        return url;
    }

    // Check if parameters already exist to avoid breaking existing transforms
    if (url.includes('/upload/') && !url.includes('/upload/f_auto') && !url.includes('/upload/w_')) {
        // RETINA SUPPORT: Request 2x density
        const targetWidth = width * 2;
        const targetHeight = height ? height * 2 : undefined;

        // Build Params:
        // f_auto: Auto format (WebP/AVIF)
        // q_auto:best: Max quality for retina screens
        // c_limit: Resize but don't upscale if original is smaller (alternatively c_fill if enforcing aspect ratio)
        // w_{width}: Resize width
        // h_{height}: Resize height (if provided)

        let params = `f_auto,q_auto:best,c_limit,w_${targetWidth}`;

        if (targetHeight) {
            params += `,h_${targetHeight}`;
        }

        return url.replace('/upload/', `/upload/${params}/`);
    }

    return url;
}
