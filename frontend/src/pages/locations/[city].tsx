import Head from 'next/head';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { eventsAPI, locationsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import { GetServerSideProps } from 'next';
import { LocationHeroBanner } from '@/components/locations/LocationHeroBanner';
import { LeadGenBlock } from '@/components/locations/LeadGenBlock';
import { EventCard } from '@/components/events/EventCard';
import CategoryGrid from '@/components/categories/CategoryGrid';
import { optimizeImage } from '@/utils/imageOptimizer';

export interface LocationPageProps {
    city: string;
    citySlug: string;
    timeframe: string;
    metaTitle: string;
    metaDescription: string;
    h1Heading: string;
    isFallback: boolean;
    fallbackNotice?: string | null;
    events: EventResponse[];
    heroImageUrl?: string | null;
    anchorText?: string | null;
    partnerLogo?: string | null;
    partnerName?: string | null;
    partnerUrl?: string | null;
    meta: {
        title: string;
        description: string;
        image: string;
        url: string;
        type: string;
    };
}

const DENSITY_THRESHOLD = 20;
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.highlandeventshub.co.uk';

/**
 * Ensures Open Graph and Twitter images are valid, absolute URLs.
 */
function resolveAbsoluteOgImage(imageUrl?: string | null): string {
    const defaultOgImage = `${SITE_URL}/images/defaults/category_festivals.jpg`;
    if (!imageUrl) return defaultOgImage;

    const optimized = optimizeImage(imageUrl, 'hero') || imageUrl;
    if (optimized.startsWith('http://') || optimized.startsWith('https://')) {
        return optimized;
    }
    const cleanPath = optimized.startsWith('/') ? optimized : `/${optimized}`;
    return `${SITE_URL}${cleanPath}`;
}

// Dynamic SEO & Data Fetching (Server Side)
export const getServerSideProps: GetServerSideProps<LocationPageProps> = async (context) => {
    const { city, timeframe } = context.params as { city: string; timeframe?: string };
    const rawCity = String(city || '').trim();
    const slug = rawCity.toLowerCase().replace(/\/+$/, '');

    // Revalidation caching headers to ensure immediate freshness for newly added or updated location hubs
    if (context.res) {
        context.res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    }

    const canonicalUrl = timeframe && timeframe !== 'all'
        ? `${SITE_URL}/locations/${slug}/${timeframe}`
        : `${SITE_URL}/locations/${slug}`;

    try {
        const feed = await locationsAPI.getFeed(slug, timeframe);

        const ogImageUrl = resolveAbsoluteOgImage(
            feed.hero_image_url || (feed.events && feed.events.length > 0 ? feed.events[0].image_url : null)
        );

        return {
            props: {
                city: feed.location_name,
                citySlug: feed.location_slug,
                timeframe: feed.timeframe || 'all',
                metaTitle: feed.meta_title,
                metaDescription: feed.meta_description,
                h1Heading: feed.h1_heading,
                isFallback: feed.is_fallback || false,
                fallbackNotice: feed.fallback_notice || null,
                events: feed.events || [],
                heroImageUrl: feed.hero_image_url || null,
                anchorText: feed.seo_anchor_text || null,
                partnerLogo: feed.partner_logo || null,
                partnerName: feed.partner_name || null,
                partnerUrl: feed.partner_url || null,
                meta: {
                    title: feed.meta_title,
                    description: feed.meta_description,
                    image: ogImageUrl,
                    url: canonicalUrl,
                    type: 'website',
                },
            }
        };
    } catch (error) {
        console.error(`[getServerSideProps Error - locations/${slug}]:`, error);

        // Fallback if API request failed
        const cityFilter = decodeURIComponent(slug).replace(/-/g, ' ');
        const formattedCity = cityFilter.replace(/\b\w/g, c => c.toUpperCase());
        const defaultTitle = `Events in ${formattedCity} | Highland Events Hub`;
        const defaultDesc = `Discover upcoming events in ${formattedCity}, Scottish Highlands.`;
        const defaultImage = `${SITE_URL}/images/defaults/category_festivals.jpg`;

        return {
            props: {
                city: formattedCity,
                citySlug: slug,
                timeframe: timeframe || 'all',
                metaTitle: defaultTitle,
                metaDescription: defaultDesc,
                h1Heading: `Events in ${formattedCity}`,
                isFallback: false,
                fallbackNotice: null,
                heroImageUrl: null,
                anchorText: null,
                partnerLogo: null,
                partnerName: null,
                partnerUrl: null,
                events: [],
                meta: {
                    title: defaultTitle,
                    description: defaultDesc,
                    image: defaultImage,
                    url: canonicalUrl,
                    type: 'website',
                },
            }
        };
    }
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
    anchorText,
    partnerLogo,
    partnerName,
    partnerUrl,
    meta
}: LocationPageProps) {
    const formattedCity = city || citySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const hasEvents = events.length > 0;
    
    const [activeCategorySlug, setActiveCategorySlug] = useState<string | undefined>(undefined);

    const displayedEvents = useMemo(() => {
        if (!activeCategorySlug) return events;
        return events.filter(event => 
            event.category?.slug === activeCategorySlug || 
            (event as any).category_slug === activeCategorySlug
        );
    }, [events, activeCategorySlug]);
    // Calculate venue count for the hero banner
    const venueCount = useMemo(() => {
        const ids = new Set(events.map(e => e.venue_id || e.venue?.id).filter(Boolean));
        return ids.size;
    }, [events]);

    // Canonical URL with sub-route support
    const canonicalUrl = timeframe && timeframe !== 'all'
        ? `${SITE_URL}/locations/${citySlug}/${timeframe}`
        : `${SITE_URL}/locations/${citySlug}`;

    // Absolute Open Graph Image Resolution
    const ogImageUrl = meta?.image || resolveAbsoluteOgImage(
        heroImageUrl || (events.length > 0 ? events[0].image_url : null)
    );

    // JSON-LD ItemList
    const jsonLd = hasEvents ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": h1Heading,
        "description": metaDescription,
        "url": canonicalUrl,
        "image": ogImageUrl,
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
                <meta name="description" content={metaDescription} key="description" />
                <link rel="canonical" href={canonicalUrl} key="canonical" />

                {/* Open Graph */}
                <meta property="og:type" content="website" key="og-type" />
                <meta property="og:url" content={canonicalUrl} key="og-url" />
                <meta property="og:title" content={metaTitle} key="og-title" />
                <meta property="og:description" content={metaDescription} key="og-description" />
                <meta property="og:image" content={ogImageUrl} key="og-image" />
                <meta property="og:image:width" content="1200" key="og-image-width" />
                <meta property="og:image:height" content="630" key="og-image-height" />
                <meta property="og:image:alt" content={metaTitle} key="og-image-alt" />
                <meta property="og:site_name" content="Highland Events Hub" key="og-site-name" />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" key="twitter-card" />
                <meta name="twitter:site" content="@HighlandEvents" key="twitter-site" />
                <meta name="twitter:title" content={metaTitle} key="twitter-title" />
                <meta name="twitter:description" content={metaDescription} key="twitter-description" />
                <meta name="twitter:image" content={ogImageUrl} key="twitter-image" />
                <meta name="twitter:image:alt" content={metaTitle} key="twitter-image-alt" />

                {/* JSON-LD */}
                {jsonLd && (
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                    />
                )}
            </Head>

            {/* Zone 1: Dynamic Full-Width SEO Hero Banner */}
            <LocationHeroBanner
                city={formattedCity}
                citySlug={citySlug}
                timeframe={timeframe}
                eventCount={events.length}
                venueCount={venueCount}
                heroImageUrl={heroImageUrl}
                anchorText={anchorText}
                h1Heading={h1Heading}
                partnerLogo={partnerLogo}
                partnerName={partnerName}
                partnerUrl={partnerUrl}
            />

            <div className="container mx-auto px-4 py-4">

                {/* Crawlable Timeframe Navigation Toolbar */}
                <div className="mb-8 flex items-center gap-2 border-b border-gray-200 pb-4 overflow-x-auto hide-scrollbar">
                    <Link
                        href={`/locations/${citySlug}`}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                            !timeframe || timeframe === 'all'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200'
                        }`}
                    >
                        All Upcoming
                    </Link>
                    <Link
                        href={`/locations/${citySlug}/today`}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                            timeframe === 'today'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200'
                        }`}
                    >
                        Today
                    </Link>
                    <Link
                        href={`/locations/${citySlug}/this-weekend`}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
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
                        <div className="mb-4 -mx-4 sm:mx-0">
                            <CategoryGrid 
                                activeCategory={activeCategorySlug}
                                onSelectCategory={(slug) => {
                                    setActiveCategorySlug(prev => prev === slug ? undefined : slug);
                                }}
                            />
                        </div>
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                All Upcoming Events
                            </h2>
                            {displayedEvents.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {displayedEvents.map((event) => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                                    <p className="text-gray-500">No events found for this category in {formattedCity}.</p>
                                    <button 
                                        onClick={() => setActiveCategorySlug(undefined)}
                                        className="mt-4 text-emerald-600 font-medium hover:text-emerald-700"
                                    >
                                        Clear Category Filter
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Lead Generation Block */}
                        <LeadGenBlock city={formattedCity} />
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
