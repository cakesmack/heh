import Head from 'next/head';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { eventsAPI, locationsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import { GetServerSideProps } from 'next';
import { LocationFeed } from '@/components/locations/LocationFeed';
import { LocationHeroBanner } from '@/components/locations/LocationHeroBanner';
import { SpotlightCard } from '@/components/locations/SpotlightCard';
import { CategorySwimlane } from '@/components/locations/CategorySwimlane';
import { LeadGenBlock } from '@/components/locations/LeadGenBlock';
import { EventCard } from '@/components/events/EventCard';

export interface LocationPageProps {
    city: string;
    citySlug: string;
    timeframe: string;
    metaTitle: string;
    metaDescription: string;
    h1Heading: string;
    isFallback: boolean;
    fallbackNotice?: string;
    events: EventResponse[];
    heroImageUrl?: string;
    anchorText?: string;
}

const DENSITY_THRESHOLD = 20;
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.highlandeventshub.co.uk';

// Dynamic SEO & Data Fetching (Server Side)
export const getServerSideProps: GetServerSideProps<LocationPageProps> = async (context) => {
    const { city, timeframe } = context.params as { city: string; timeframe?: string };
    const slug = String(city).toLowerCase().trim();

    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';
        const timeframeParam = timeframe ? `/${timeframe}` : '';
        const res = await fetch(`${apiUrl}/api/locations/feed/${slug}${timeframeParam}`);

        if (res.ok) {
            const feed = await res.json();
            return {
                props: {
                    city: feed.location_name,
                    citySlug: feed.location_slug,
                    timeframe: feed.timeframe || 'all',
                    metaTitle: feed.meta_title,
                    metaDescription: feed.meta_description,
                    h1Heading: feed.h1_heading,
                    isFallback: feed.is_fallback || false,
                    fallbackNotice: feed.fallback_notice || undefined,
                    events: feed.events || [],
                    heroImageUrl: feed.hero_image_url || undefined,
                    anchorText: feed.seo_anchor_text || undefined,
                }
            };
        }
    } catch (error) {
        console.error('Error fetching location feed:', error);
    }

    // Fallback if API request failed
    const cityFilter = decodeURIComponent(slug).replace(/-/g, ' ');
    const formattedCity = cityFilter.replace(/\b\w/g, c => c.toUpperCase());

    return {
        props: {
            city: formattedCity,
            citySlug: slug,
            timeframe: timeframe || 'all',
            metaTitle: `Events in ${formattedCity} | Highland Events Hub`,
            metaDescription: `Discover upcoming events in ${formattedCity}, Scottish Highlands.`,
            h1Heading: `Events in ${formattedCity}`,
            isFallback: false,
            fallbackNotice: undefined,
            events: [],
        }
    };
};

export default function LocationPage({
    city,
    citySlug,
    timeframe,
    metaTitle,
    metaDescription,
    h1Heading,
    isFallback,
    fallbackNotice,
    events,
    heroImageUrl,
    anchorText
}: LocationPageProps) {
    const formattedCity = city || citySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const hasEvents = events.length > 0;
    const isHighDensity = events.length >= DENSITY_THRESHOLD;

    // Canonical URL with sub-route support
    const canonicalUrl = timeframe && timeframe !== 'all'
        ? `${SITE_URL}/locations/${citySlug}/${timeframe}`
        : `${SITE_URL}/locations/${citySlug}`;

    // Compute spotlight event
    const spotlightEvent = useMemo(() => {
        if (events.length === 0) return null;

        if (isHighDensity) {
            return [...events].sort((a, b) =>
                (b.popularity_score ?? 0) - (a.popularity_score ?? 0)
            )[0];
        } else {
            return events[0];
        }
    }, [events, isHighDensity]);

    // Remaining events (excluding spotlight)
    const remainingEvents = useMemo(() => {
        if (!spotlightEvent) return events;
        return events.filter(e => e.id !== spotlightEvent.id);
    }, [events, spotlightEvent]);

    // Category swimlanes
    const swimlanes = useMemo(() => {
        if (!isHighDensity) return [];

        const categoryMap = new Map<string, { name: string; events: EventResponse[] }>();

        for (const event of remainingEvents) {
            const slug = event.category?.slug || 'other';
            const name = event.category?.name || 'Other';

            if (!categoryMap.has(slug)) {
                categoryMap.set(slug, { name, events: [] });
            }
            categoryMap.get(slug)!.events.push(event);
        }

        return Array.from(categoryMap.values())
            .filter(cat => cat.events.length >= 2)
            .sort((a, b) => b.events.length - a.events.length);
    }, [remainingEvents, isHighDensity]);

    // JSON-LD ItemList
    const jsonLd = hasEvents ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": h1Heading,
        "description": metaDescription,
        "url": canonicalUrl,
        "numberOfItems": events.length,
        "itemListElement": events.slice(0, 10).map((event, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "url": `${SITE_URL}/events/${event.slug || event.id}`,
            "name": event.title,
        })),
    } : null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Head>
                <title>{metaTitle}</title>
                <meta name="description" content={metaDescription} />
                <link rel="canonical" href={canonicalUrl} />
                {/* Open Graph */}
                <meta property="og:title" content={metaTitle} />
                <meta property="og:description" content={metaDescription} />
                <meta property="og:url" content={canonicalUrl} />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Highland Events Hub" />
                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={metaTitle} />
                <meta name="twitter:description" content={metaDescription} />
                {/* JSON-LD */}
                {jsonLd && (
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                    />
                )}
            </Head>

            <div className="container mx-auto px-4 py-8">
                {/* Zone 1: Dynamic SEO Hero Banner */}
                <LocationHeroBanner
                    city={formattedCity}
                    eventCount={events.length}
                    heroImageUrl={heroImageUrl}
                    anchorText={anchorText}
                    h1Heading={h1Heading}
                />

                {/* Crawlable Timeframe Navigation Tabs */}
                <div className="mb-8 flex items-center gap-2 border-b border-gray-200 pb-4">
                    <Link
                        href={`/locations/${citySlug}`}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                            !timeframe || timeframe === 'all'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200'
                        }`}
                    >
                        All Upcoming
                    </Link>
                    <Link
                        href={`/locations/${citySlug}/today`}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                            timeframe === 'today'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200'
                        }`}
                    >
                        Today
                    </Link>
                    <Link
                        href={`/locations/${citySlug}/this-weekend`}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                            timeframe === 'this-weekend'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200'
                        }`}
                    >
                        This Weekend
                    </Link>
                </div>

                {/* Thin Content / Empty State Fallback Notice */}
                {isFallback && fallbackNotice && (
                    <div className="mb-8 p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-r-xl font-medium text-sm shadow-sm flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{fallbackNotice}</span>
                    </div>
                )}

                {hasEvents ? (
                    <>
                        {/* Zone 2: Spotlight Card */}
                        {spotlightEvent && (
                            <SpotlightCard
                                event={spotlightEvent}
                                label={isHighDensity ? 'Trending' : 'Up Next'}
                            />
                        )}

                        {isHighDensity ? (
                            /* ===== CONDITION A: High-Density Layout (>= 20 events) ===== */
                            <>
                                {/* Zone 3: Category Swimlanes */}
                                {swimlanes.length > 0 && (
                                    <div className="mb-8">
                                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                            Browse by Category
                                        </h2>
                                        {swimlanes.map((lane) => (
                                            <CategorySwimlane
                                                key={lane.name}
                                                categoryName={lane.name}
                                                events={lane.events}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Zone 4: Full Filtered Grid */}
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                        All Events
                                    </h2>
                                    <LocationFeed initialEvents={remainingEvents} city={formattedCity} />
                                </div>
                            </>
                        ) : (
                            /* ===== CONDITION B: Low-Density Layout (< 20 events) ===== */
                            <>
                                {/* Zone 3: Simple Chronological Grid */}
                                {remainingEvents.length > 0 && (
                                    <div className="mb-8">
                                        <h2 className="text-xl font-bold text-gray-900 mb-5">
                                            {remainingEvents.length} More Event{remainingEvents.length !== 1 ? 's' : ''} Coming Up
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {remainingEvents.map((event) => (
                                                <EventCard key={event.id} event={event} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Zone 4: Lead Generation Block */}
                                <LeadGenBlock city={formattedCity} />
                            </>
                        )}
                    </>
                ) : (
                    /* ===== EMPTY STATE ===== */
                    <>
                        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                No events currently scheduled in {formattedCity}
                            </h2>
                            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                                Check back soon or broaden your search to see what's happening nearby.
                            </p>
                            <Link href="/events" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors">
                                Browse All Events
                            </Link>
                        </div>

                        <LeadGenBlock city={formattedCity} />
                    </>
                )}
            </div>
        </div>
    );
}
