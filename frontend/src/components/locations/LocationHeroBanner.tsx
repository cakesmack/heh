import React from 'react';
import Link from 'next/link';
import OptimizedImage from '@/components/ui/OptimizedImage';

interface LocationHeroBannerProps {
  city: string;
  citySlug?: string;
  timeframe?: string;
  eventCount: number;
  venueCount?: number;
  heroImageUrl?: string | null;
  anchorText?: string | null;
  h1Heading?: string;
}

const FALLBACK_IMAGE = '/images/defaults/category_festivals.jpg';

export function LocationHeroBanner({
  city,
  citySlug,
  timeframe,
  eventCount,
  venueCount = 0,
  heroImageUrl,
  anchorText,
  h1Heading,
}: LocationHeroBannerProps) {
  const formattedCity = city.replace(/\b\w/g, (c) => c.toUpperCase());
  const bgImage = heroImageUrl || FALLBACK_IMAGE;
  const headingText = h1Heading || `Events in ${formattedCity}`;
  const activeTimeframe = timeframe || 'all';

  return (
    <section className="relative w-full overflow-hidden bg-gray-900 min-h-[420px] flex flex-col justify-end mb-8">
      {/* Background Image */}
      <div className="absolute inset-0">
        <OptimizedImage
          src={bgImage}
          alt={headingText}
          fill
          className="object-cover"
          sizes="100vw"
          variant="hero"
          priority
        />
      </div>

      {/* Balanced Dark Scrim Gradients */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-gray-950 via-gray-950/60 to-gray-950/40" />

      {/* Content Container - Grid Aligned */}
      <div className="relative z-[2] container mx-auto px-4 py-6 md:py-8 w-full flex flex-col gap-6">
        
        {/* Main Hero Card (Frosted Glass) */}
        <div className="backdrop-blur-md bg-black/40 border border-white/10 rounded-2xl p-6 md:p-10 max-w-5xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            
            {/* Left Column: Title, Description & Metrics */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                {headingText}
              </h1>
              <p className="text-gray-200 text-sm md:text-base leading-relaxed mt-4 max-w-2xl">
                {anchorText
                  ? anchorText
                  : eventCount > 0
                    ? `Discover ${eventCount} upcoming event${eventCount !== 1 ? 's' : ''} in ${formattedCity}, Scottish Highlands.`
                    : `Explore what's happening in ${formattedCity}, Scottish Highlands.`}
              </p>

              {/* Metrics */}
              <div className="flex flex-wrap items-center gap-3 mt-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {eventCount} Upcoming Event{eventCount !== 1 ? 's' : ''}
                </span>

                {venueCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5m0 0v-5a2 2 0 00-2-2h-2a2 2 0 00-2 2v5" />
                    </svg>
                    {venueCount} Venue{venueCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Right Column: Action Buttons */}
            <div className="flex flex-row items-center gap-3 shrink-0">
              <Link
                href="/submit-event"
                className="w-full md:w-auto inline-flex justify-center items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Submit Event
              </Link>

              <Link
                href="/map"
                className="w-full md:w-auto inline-flex justify-center items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                View Map
              </Link>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
