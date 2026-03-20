import React from 'react';
import OptimizedImage from '@/components/ui/OptimizedImage';

interface LocationHeroBannerProps {
  city: string;
  eventCount: number;
  heroImageUrl?: string;
  anchorText?: string;
}

const FALLBACK_IMAGE = '/images/defaults/category_festivals.jpg';

export function LocationHeroBanner({ city, eventCount, heroImageUrl, anchorText }: LocationHeroBannerProps) {
  const formattedCity = city.replace(/\b\w/g, (c) => c.toUpperCase());
  const bgImage = heroImageUrl || FALLBACK_IMAGE;

  return (
    <section
      className="relative w-full overflow-hidden rounded-2xl mb-8"
      style={{ minHeight: '280px' }}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <OptimizedImage
          src={bgImage}
          alt={`Events in ${formattedCity}`}
          fill
          className="object-cover"
          sizes="100vw"
          variant="hero"
          priority
        />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-gray-900 via-gray-900/90 to-gray-900/20" />

      {/* Content */}
      <div className="relative z-[2] flex flex-col justify-end h-full min-h-[280px] px-6 md:px-10 py-8 md:py-10">
        <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
          Events in {formattedCity}
        </h1>

        <p className="text-gray-200 text-sm md:text-base leading-relaxed w-full lg:w-5/6 max-w-5xl">
          {anchorText
            ? anchorText
            : eventCount > 0
              ? `Discover ${eventCount} upcoming event${eventCount !== 1 ? 's' : ''} in ${formattedCity}, Scottish Highlands.`
              : `Explore what's happening in ${formattedCity}, Scottish Highlands.`}
        </p>
      </div>
    </section>
  );
}
