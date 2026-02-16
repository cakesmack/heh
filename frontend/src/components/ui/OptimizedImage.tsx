import React from 'react';
import Image, { ImageProps } from 'next/image';
import { optimizeImage } from '@/utils/imageOptimizer';

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
    src: string | null | undefined;
    variant?: 'thumb' | 'hero';
    fallback?: string;
}

/**
 * Standardized Image component that handles both Cloudinary and Cloudflare images.
 * Provides automatic optimization based on variants or dimensions.
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    variant = 'hero',
    fallback = '/images/event-placeholder.jpg',
    alt = 'Image',
    width,
    height,
    fill,
    ...props
}) => {
    // Use the optimized URL or fallback
    // If a numeric width is explicitly provided and no variant is specified, use width for optimization
    const optimizationToken = (typeof width === 'number' && !variant) ? width : variant;
    const optimizedUrl = src ? optimizeImage(src, optimizationToken as any) : fallback;

    // Final safety check: if optimizedUrl is empty, use fallback
    const finalSrc = optimizedUrl || fallback;

    return (
        <Image
            src={finalSrc}
            alt={alt}
            width={!fill ? width : undefined}
            height={!fill ? height : undefined}
            fill={fill}
            {...props}
        />
    );
};

export default OptimizedImage;
