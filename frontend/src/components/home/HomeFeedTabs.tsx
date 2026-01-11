import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { EventResponse, User } from '@/types';
import { api, eventsAPI } from '@/lib/api';
import MagazineGrid from '@/components/home/MagazineGrid';
import { Spinner } from '@/components/common/Spinner';

interface HomeFeedTabsProps {
    latestEvents: EventResponse[];
    user: User | null;
}

export default function HomeFeedTabs({ latestEvents, user }: HomeFeedTabsProps) {
    const [activeTab, setActiveTab] = useState<'latest' | 'tonight' | 'feed'>('latest');
    const [feedEvents, setFeedEvents] = useState<EventResponse[]>([]);
    const [tonightEvents, setTonightEvents] = useState<EventResponse[]>([]);
    const [isLoadingFeed, setIsLoadingFeed] = useState(false);
    const [isLoadingTonight, setIsLoadingTonight] = useState(false);
    const [hasFetchedFeed, setHasFetchedFeed] = useState(false);
    const [hasFetchedTonight, setHasFetchedTonight] = useState(false);

    // Magazine Carousel: Paid bookings take priority
    const [magazineBookingEvents, setMagazineBookingEvents] = useState<EventResponse[]>([]);
    const [heroEventIds, setHeroEventIds] = useState<Set<string>>(new Set());

    // Helper to normalize IDs (handle dash vs no-dash UUIDs)
    const normalizeId = (id: string) => {
        if (!id) return '';
        // 1. Split by underscore to remove date suffix (abc-123_2025... -> abc-123)
        // 2. Remove dashes to normalize UUID (abc-123 -> abc123)
        return id.split('_')[0].replace(/-/g, '');
    };

    // Fetch magazine_carousel AND hero_home bookings on mount
    useEffect(() => {
        const fetchBookings = async () => {
            try {
                // Parallel fetch: Magazine (for display) nad Hero (for exclusion)
                const [magazineBookings, heroBookings] = await Promise.all([
                    api.featured.getActive('magazine_carousel'),
                    api.featured.getActive('hero_home').catch(() => [])
                ]);

                // 1. Setup Magazine Events
                const eventPromises = magazineBookings.map((b) =>
                    eventsAPI.get(b.event_id).catch(() => null)
                );
                const events = (await Promise.all(eventPromises)).filter(Boolean) as EventResponse[];
                setMagazineBookingEvents(events);

                // 2. Setup Hero IDs for Exclusion (Normalized)

                // Update this block inside your useEffect
                const heroIds = new Set(heroBookings.map(b => {
                    // Check event_id first (per your JSON), fallback to target_id
                    const id = b.event_id || b.target_id;
                    return id ? normalizeId(id) : null;
                }).filter(Boolean) as string[]);

                setHeroEventIds(heroIds);

            } catch (err) {
                console.error('Error fetching bookings:', err);
            }
        };
        fetchBookings();
    }, []);

    // Merge magazine booking events with latest events (bookings first)
    // STRICT SEPARATION: Filter out any event that is currently in the Hero Carousel
    const mergedLatestEvents = React.useMemo(() => {
        // Normalize Magazine IDs for dedup
        const magazineIds = new Set(
            magazineBookingEvents.map(e => normalizeId(e.id))
        );

        // Filter latestEvents:
        // 1. Must not be already in magazineBookingEvents (deduplication)
        // 2. Must not be a Hero Event (strict separation)
        const nonBookingLatest = latestEvents.filter(e => {
            const nId = normalizeId(e.id);
            // Strict check using normalized IDs
            return !magazineIds.has(nId) && !heroEventIds.has(nId);
        });

        return [...magazineBookingEvents, ...nonBookingLatest];
    }, [magazineBookingEvents, latestEvents, heroEventIds]);

    // Fetch Tonight events when tab is clicked
    useEffect(() => {
        if (activeTab === 'tonight' && !hasFetchedTonight) {
            const fetchTonight = async () => {
                setIsLoadingTonight(true);
                try {
                    const today = new Date();
                    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
                    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

                    const data = await eventsAPI.list({
                        date_from: startOfDay,
                        date_to: endOfDay,
                        limit: 20
                    });
                    setTonightEvents(data.events || []);
                    setHasFetchedTonight(true);
                } catch (error) {
                    console.error('Error fetching tonight events:', error);
                } finally {
                    setIsLoadingTonight(false);
                }
            };
            fetchTonight();
        }
    }, [activeTab, hasFetchedTonight]);

    // Fetch My Feed events when tab is clicked
    useEffect(() => {
        if (activeTab === 'feed' && user && !hasFetchedFeed) {
            const fetchFeed = async () => {
                setIsLoadingFeed(true);
                try {
                    const data = await api.social.getFeed();
                    setFeedEvents(data || []);
                    setHasFetchedFeed(true);
                } catch (error) {
                    console.error('Error fetching feed:', error);
                } finally {
                    setIsLoadingFeed(false);
                }
            };
            fetchFeed();
        }
    }, [activeTab, user, hasFetchedFeed]);

    return (
        <section className="py-6 bg-white">
            {/* Tabs Header - Centered Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-center space-x-8 mb-8 border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('latest')}
                        className={`pb-4 text-lg font-bold transition-colors relative ${activeTab === 'latest'
                            ? 'text-emerald-900 border-b-2 border-emerald-600'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        Latest Events
                    </button>
                    <button
                        onClick={() => setActiveTab('tonight')}
                        className={`pb-4 text-lg font-bold transition-colors relative flex items-center ${activeTab === 'tonight'
                            ? 'text-emerald-900 border-b-2 border-emerald-600'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        🌙 Tonight
                    </button>
                    <button
                        onClick={() => setActiveTab('feed')}
                        className={`pb-4 text-lg font-bold transition-colors relative flex items-center ${activeTab === 'feed'
                            ? 'text-emerald-900 border-b-2 border-emerald-600'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        My Feed
                        {!user && (
                            <svg className="w-4 h-4 ml-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Content Body - Full Width */}
            <div className="min-h-[400px]">
                {activeTab === 'latest' ? (
                    <>
                        <MagazineGrid events={mergedLatestEvents} carouselEvents={magazineBookingEvents} hideHeader={true} hideFooter={true} />
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center">
                            <Link
                                href="/events"
                                className="inline-flex items-center text-emerald-600 font-semibold hover:text-emerald-700"
                            >
                                View All Events
                                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </Link>
                        </div>
                    </>
                ) : activeTab === 'tonight' ? (
                    // Tonight Tab Content
                    <div className="animate-fade-in">
                        {isLoadingTonight ? (
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <div className="flex justify-center py-20">
                                    <Spinner size="lg" />
                                </div>
                            </div>
                        ) : tonightEvents.length === 0 ? (
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <span className="text-3xl">🌙</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Events Tonight</h3>
                                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                                        Check back later or browse our full events list to find something happening soon.
                                    </p>
                                    <Link
                                        href="/events"
                                        className="inline-block px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                                    >
                                        Browse Events
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <MagazineGrid events={tonightEvents} hideHeader={true} hideFooter={true} />
                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center">
                                    <Link
                                        href="/events?date=today"
                                        className="inline-flex items-center text-emerald-600 font-semibold hover:text-emerald-700"
                                    >
                                        View All Tonight's Events
                                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    // Feed Tab Content
                    <div className="animate-fade-in">
                        {!user ? (
                            // Guest State - Contained
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Personalize Your Experience</h3>
                                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                                        Log in to see events from venues and organizers you follow directly in your feed.
                                    </p>
                                    <Link
                                        href="/login?redirect=/"
                                        className="inline-block px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                                    >
                                        Log In / Sign Up
                                    </Link>
                                </div>
                            </div>
                        ) : isLoadingFeed ? (
                            // Loading State - Contained
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <div className="flex justify-center py-20">
                                    <Spinner size="lg" />
                                </div>
                            </div>
                        ) : feedEvents.length === 0 ? (
                            // Empty State - Contained
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Your Feed is Empty</h3>
                                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                                        Follow your favorite venues and organizers to see their latest events here.
                                    </p>
                                    <Link
                                        href="/venues"
                                        className="inline-block px-6 py-2 bg-white text-emerald-600 font-semibold rounded-lg border-2 border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
                                    >
                                        Browse Venues
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            // Feed Content - Full Width
                            <>
                                <MagazineGrid events={feedEvents} hideHeader={true} hideFooter={true} />
                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center">
                                    <Link
                                        href="/events/feed"
                                        className="inline-flex items-center text-emerald-600 font-semibold hover:text-emerald-700"
                                    >
                                        View All Feed Events
                                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
