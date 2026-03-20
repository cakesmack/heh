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

interface LocationPageProps {
    city: string;
    events: EventResponse[];
    heroImageUrl?: string;
    anchorText?: string;
}

const DENSITY_THRESHOLD = 20;
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.highlandeventshub.co.uk';

// Dynamic SEO & Data Fetching (Server Side)
export const getServerSideProps: GetServerSideProps<LocationPageProps> = async (context) => {
    const { city } = context.params as { city: string };

    // Convert "fort-william" -> "fort william"
    const slug = String(city);
    const cityFilter = decodeURIComponent(slug).replace(/-/g, ' ');

    let events: EventResponse[] = [];
    let heroImageUrl: string | null = null;
    let anchorText: string | null = null;

    try {
        // Fetch events and location data in parallel
        const [eventsRes, allLocations] = await Promise.all([
            eventsAPI.list({
                // @ts-ignore - city_filter is now supported in API client
                city_filter: cityFilter,
                limit: 200,
                sort_by: 'date',
                time_range: 'upcoming'
            }),
            locationsAPI.list().catch(() => []),
        ]);

        // Match location by slug
        const locationRecord = allLocations.find(
            (loc: any) => loc.slug === slug
        );
        if (locationRecord) {
            heroImageUrl = locationRecord.hero_image_url || null;
            anchorText = locationRecord.seo_anchor_text || null;
        }

        // Flatten and reduce payload size
        events = JSON.parse(JSON.stringify(
            eventsRes.events.map(event => ({
                ...event,
                description: event.description ? event.description.replace(/<[^>]*>?/gm, '').substring(0, 200) : '',
                participating_venues: [],
                organizer_profile: undefined,
                showtimes: event.showtimes ? event.showtimes.slice(0, 3) : []
            }))
        ));

    } catch (error) {
        console.error('Error fetching location events:', error);
    }

    return {
        props: {
            city: cityFilter,
            events,
            ...(heroImageUrl ? { heroImageUrl } : {}),
            ...(anchorText ? { anchorText } : {}),
        }
    };
};

export default function LocationPage({ city, events, heroImageUrl, anchorText }: LocationPageProps) {
    const formattedCity = city.replace(/\b\w/g, c => c.toUpperCase());
    const hasEvents = events.length > 0;
    const isHighDensity = events.length >= DENSITY_THRESHOLD;

    // Slug for canonical URL
    const citySlug = city.replace(/\s+/g, '-').toLowerCase();
    const canonicalUrl = `${SITE_URL}/locations/${citySlug}`;

    // Compute spotlight event
    const spotlightEvent = useMemo(() => {
        if (events.length === 0) return null;

        if (isHighDensity) {
            // Condition A: Highest velocity score
            return [...events].sort((a, b) =>
                (b.popularity_score ?? 0) - (a.popularity_score ?? 0)
            )[0];
        } else {
            // Condition B: Next chronological event (already sorted date ASC from backend)
            return events[0];
        }
    }, [events, isHighDensity]);

    // Remaining events (excluding spotlight)
    const remainingEvents = useMemo(() => {
        if (!spotlightEvent) return events;
        return events.filter(e => e.id !== spotlightEvent.id);
    }, [events, spotlightEvent]);

    // Category swimlanes (Condition A only)
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

        // Only return categories with >= 2 events, sorted by count desc
        return Array.from(categoryMap.values())
            .filter(cat => cat.events.length >= 2)
            .sort((a, b) => b.events.length - a.events.length);
    }, [remainingEvents, isHighDensity]);

    // SEO meta description
    const metaDescription = hasEvents
        ? `Discover ${events.length} upcoming event${events.length !== 1 ? 's' : ''} in ${formattedCity}, Scottish Highlands. Live music, festivals, food, outdoors and more.`
        : `Find local events, gigs, and festivals in ${formattedCity}, Scottish Highlands.`;

    // JSON-LD ItemList
    const jsonLd = hasEvents ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `Events in ${formattedCity}`,
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
                <title>{`Events in ${formattedCity} | Highland Events Hub`}</title>
                <meta name="description" content={metaDescription} />
                <link rel="canonical" href={canonicalUrl} />
                {/* Open Graph */}
                <meta property="og:title" content={`Events in ${formattedCity} | Highland Events Hub`} />
                <meta property="og:description" content={metaDescription} />
                <meta property="og:url" content={canonicalUrl} />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Highland Events Hub" />
                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={`Events in ${formattedCity} | Highland Events Hub`} />
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
                {/* Zone 1: Dynamic SEO Hero Banner (Both Conditions) */}
                <LocationHeroBanner city={city} eventCount={events.length} heroImageUrl={heroImageUrl} anchorText={anchorText} />

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
                                    <LocationFeed initialEvents={remainingEvents} city={city} />
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
                                <LeadGenBlock city={city} />
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

                        <LeadGenBlock city={city} />
                    </>
                )}
            </div>
        </div>
    );
}
