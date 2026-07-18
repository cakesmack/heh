/**
 * Collection Page — /collections/[slug]
 * Renders a hero banner and a filtered event grid for a curated collection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { collectionsAPI, eventsAPI } from '@/lib/api';
import { getDateRangeFromFilter } from '@/lib/dateUtils';
import { EventList } from '@/components/events/EventList';
import { Spinner } from '@/components/common/Spinner';
import { EventFilters } from '@/components/events/EventFilters';
import type { Metadata } from 'next';
import type { Collection, EventFilter, EventResponse } from '@/types';
import { optimizeImage } from '@/utils/imageOptimizer';

const EVENTS_PER_PAGE = 12;

/**
 * Convert the collection's filter_params JSON into an EventFilter object.
 */
function buildEventFilter(params: Record<string, any>): EventFilter {
    const filter: EventFilter = {};

    if (params.category) {
        // category is stored as an array; join for the API which expects a comma string
        filter.category = Array.isArray(params.category)
            ? params.category.join(',') as any
            : params.category;
    }
    if (params.category_ids) {
        filter.category_ids = Array.isArray(params.category_ids)
            ? params.category_ids
            : params.category_ids.split(',');
    }
    if (params.q) filter.q = params.q;
    if (params.combine_operator) filter.combine_operator = params.combine_operator;

    if (params.age_restriction) filter.age_restriction = params.age_restriction;

    // Price handling: 'free' → price_max: 0
    if (params.price === 'free') {
        filter.price_max = 0;
    }

    // Recurrence
    if (params.is_recurring === true) filter.is_recurring = true;
    if (params.is_recurring === false) filter.is_recurring = false;

    // Date range
    if (params.date === 'custom') {
        if (params.date_from) filter.date_from = params.date_from;
        if (params.date_to) filter.date_to = params.date_to;
    } else if (params.date) {
        const range = getDateRangeFromFilter(params.date, params.date_from, params.date_to);
        if (range.date_from) filter.date_from = range.date_from;
        if (range.date_to) filter.date_to = range.date_to;
    }

    // Exclusion filters
    if (params.exclude_age_restrictions) {
        filter.exclude_age_restrictions = Array.isArray(params.exclude_age_restrictions)
            ? params.exclude_age_restrictions
            : params.exclude_age_restrictions.split(',');
    }
    if (params.exclude_event_ids) {
        filter.exclude_event_ids = Array.isArray(params.exclude_event_ids)
            ? params.exclude_event_ids
            : params.exclude_event_ids.split(',');
    }

    return filter;
}

/**
 * Merge base collection filters with user-facing interactive filters.
 */
function mergeFilters(base: EventFilter, user: EventFilter): EventFilter {
    const merged = { ...base, ...user };

    // Special logic for keywords: Append user keywords to base keywords
    if (base.q && user.q && base.q !== user.q) {
        merged.q = `${base.q} ${user.q}`;
    }

    return merged;
}

/**
 * Dynamic metadata generation for independent indexing (Next.js alternates.canonical config).
 */
export async function generateMetadata({
    params
}: {
    params: { slug: string };
}): Promise<Metadata> {
    const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.highlandeventshub.co.uk';
    return {
        alternates: {
            canonical: `${siteUrl}/collections/${params.slug}`
        }
    };
}


export default function CollectionPage() {
    const router = useRouter();
    const { slug } = router.query;

    // Collection state
    const [collection, setCollection] = useState<Collection | null>(null);
    const [collectionLoading, setCollectionLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    // Events state
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [userFilters, setUserFilters] = useState<EventFilter>({});
    const [currentFilters, setCurrentFilters] = useState<EventFilter>({});

    const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.highlandeventshub.co.uk';
    const canonicalUrl = collection ? `${siteUrl.replace(/\/$/, '')}/collections/${collection.slug}` : '';

    // Infinite scroll
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Prevent infinite loop on fetchEvents
    const initialFiltersSet = useRef(false);

    // Fetch collection by slug
    useEffect(() => {
        if (!router.isReady || !slug) return;

        initialFiltersSet.current = false;

        const fetchCollection = async () => {
            setCollectionLoading(true);
            setNotFound(false);
            try {
                const data = await collectionsAPI.getBySlug(slug as string);
                setCollection(data);
            } catch (err: any) {
                if (err?.status === 404 || err?.message?.includes('404')) {
                    setNotFound(true);
                } else {
                    setNotFound(true);
                }
            } finally {
                setCollectionLoading(false);
            }
        };

        fetchCollection();
    }, [router.isReady, slug]);

    // Fetch events when collection is loaded
    const fetchEvents = useCallback(async (filters: EventFilter, append = false, skipOverride?: number) => {
        if (append) {
            setIsLoadingMore(true);
        } else {
            setEventsLoading(true);
            setEvents([]);
        }
        setEventsError(null);

        try {
            console.log("SENDING TO API:", filters);
            const response = await eventsAPI.list({
                ...filters,
                limit: EVENTS_PER_PAGE,
                skip: append ? (skipOverride !== undefined ? skipOverride : 0) : 0,
            });

            if (append) {
                setEvents(prev => [...prev, ...response.events]);
            } else {
                setEvents(response.events);
            }
            setTotal(response.total);
            setCurrentFilters(filters);
        } catch (err) {
            setEventsError(err instanceof Error ? err.message : 'Failed to fetch events');
        } finally {
            setEventsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        if (!collection) return;

        if (collection.filter_params && Object.keys(collection.filter_params).length > 0) {
            const baseFilters = buildEventFilter(collection.filter_params);
            const merged = mergeFilters(baseFilters, userFilters);
            fetchEvents(merged);
        } else {
            fetchEvents(userFilters);
        }
    }, [collection, userFilters, fetchEvents]);

    // Infinite scroll observer
    useEffect(() => {
        const hasMore = events.length < total;
        if (!loadMoreRef.current || isLoadingMore || eventsLoading || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    fetchEvents(currentFilters, true, events.length);
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [events.length, total, isLoadingMore, eventsLoading, currentFilters, fetchEvents]);

    const hasMore = events.length < total;

    // --- Loading state ---
    if (collectionLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Spinner size="lg" />
            </div>
        );
    }

    // --- 404 state ---
    if (notFound || !collection) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <svg className="w-20 h-20 text-gray-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Collection Not Found</h1>
                <p className="text-gray-600 mb-6">This collection may have been removed or doesn&apos;t exist.</p>
                <Link
                    href="/"
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                >
                    Back to Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <Head>
                <title>{(collection as any).seo_title || collection.title} | Highland Events Hub</title>
                {/* Fallback to seo_description, then subtitle, then description */}
                {((collection as any).seo_description || collection.subtitle || collection.description) && (
                    <meta name="description" content={((collection as any).seo_description || collection.subtitle || collection.description)} />
                )}
                {canonicalUrl && <link rel="canonical" href={canonicalUrl} key="canonical" />}
            </Head>

            {/* SECTION 1: HERO - ONLY PLACE FOR SHORT DESCRIPTION */}
            <section className="relative h-[40vh] flex items-end pb-12">
                {/* Background Image Logic Here */}
                {collection.image_url && (
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${optimizeImage(collection.image_url, 'hero')})` }}
                    />
                )}
                {/* Dark gradient overlay for text legibility */}
                <div className="absolute inset-0 bg-black/40 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 text-white w-full">
                    {collection.subtitle && (
                        <span className="block mb-2 text-sm font-semibold tracking-wide uppercase text-emerald-400">
                            {collection.subtitle}
                        </span>
                    )}
                    <h1 className="text-5xl font-bold">{collection.title}</h1>
                    {collection.description && (
                        <p className="text-xl mt-4">{collection.description}</p>
                    )}
                </div>
            </section>



            {/* SECTION 2: FILTERS */}
            <section className="max-w-7xl mx-auto py-8 px-4 border-b border-gray-100">
                <EventFilters
                    onFilterChange={(newFilters) => setUserFilters(newFilters as any)}
                    initialFilters={userFilters}
                    isCollectionMode={true}
                />
            </section>

            {/* SECTION 3: EVENTS LIST */}
            <section className="max-w-7xl mx-auto py-12 px-4">
                {eventsLoading && !events.length ? (
                    <div className="flex justify-center py-8">
                        <Spinner size="lg" />
                    </div>
                ) : (
                    <>
                        <div className="mb-6">
                            <p className="text-sm text-gray-600">
                                {total} event{total !== 1 ? 's' : ''} in this collection
                            </p>
                        </div>
                        <EventList events={events} isLoading={eventsLoading} error={eventsError} />

                        {/* Infinite Scroll Sentinel */}
                        {hasMore && !eventsLoading && !eventsError && (
                            <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
                                {isLoadingMore && (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        <span>Loading more events...</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
