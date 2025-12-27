import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { EventList } from '@/components/events/EventList';
import DiscoveryBar from '@/components/home/DiscoveryBar';
import { Category, EventFilter } from '@/types';
import { getDateRangeFromFilter } from '@/lib/dateUtils';

export default function CategoryPage() {
    const router = useRouter();
    const { slug } = router.query;

    const [category, setCategory] = useState<Category | null>(null);
    const [isLoadingCategory, setIsLoadingCategory] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Event fetching
    const { events, total, isLoading: isLoadingEvents, error: eventsError, fetchEvents } = useEvents({ autoFetch: false });
    const [initialFilters, setInitialFilters] = useState<Partial<EventFilter>>({});

    // Fetch Category Details
    useEffect(() => {
        if (!slug) return;

        const fetchCategory = async () => {
            setIsLoadingCategory(true);
            try {
                const data = await api.categories.get(slug as string);
                setCategory(data);

                // Initialize filters for this category
                const filters = {
                    category: data.slug as any, // Cast to any to satisfy EventCategory enum if needed, or string
                };
                setInitialFilters(filters);

                // Fetch events for this category
                fetchEvents(filters);
            } catch (err) {
                console.error('Failed to fetch category:', err);
                setError('Category not found');
            } finally {
                setIsLoadingCategory(false);
            }
        };

        fetchCategory();
    }, [slug]);

    // Follow logic
    const { user } = useAuth();
    const [isFollowing, setIsFollowing] = useState(false);
    const [isFollowLoading, setIsFollowLoading] = useState(false);

    useEffect(() => {
        if (user && category) {
            api.categories.checkFollowing(category.id)
                .then(res => setIsFollowing(res.following))
                .catch(console.error);
        }
    }, [user, category]);

    const handleFollowToggle = async () => {
        if (!user) {
            router.push(`/login?redirect=/category/${slug}`);
            return;
        }
        if (!category) return;

        setIsFollowLoading(true);
        // Optimistic update
        const newState = !isFollowing;
        setIsFollowing(newState);

        try {
            if (newState) {
                await api.categories.follow(category.id);
            } else {
                await api.categories.unfollow(category.id);
            }
        } catch (err) {
            console.error('Failed to toggle follow:', err);
            // Revert on error
            setIsFollowing(!newState);
        } finally {
            setIsFollowLoading(false);
        }
    };

    const handleSearch = (filters: {
        q?: string;
        location?: string;
        date?: string;
        dateFrom?: string;
        dateTo?: string;
        category?: string;
    }) => {
        const dateRange = getDateRangeFromFilter(filters.date || '', filters.dateFrom, filters.dateTo);

        // Search within the current category context
        const searchFilters: any = {
            ...filters,
            category: category?.slug as any, // Ensure we stay in the current category
            ...dateRange,
        };

        if (filters.date) {
            delete searchFilters.date;
            delete searchFilters.dateFrom;
            delete searchFilters.dateTo;
        }

        // Update URL params shallowly to reflect search state (optional but good for UX)
        const query: Record<string, string> = { slug: slug as string };
        if (filters.q) query.q = filters.q;
        if (filters.location) query.location = filters.location;
        if (filters.date) query.date = filters.date;

        router.push({ pathname: `/category/${slug}`, query }, undefined, { shallow: true });

        fetchEvents(searchFilters);
    };

    if (isLoadingCategory) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (error || !category) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Category Not Found</h1>
                <p className="text-gray-600 mb-8">The category you are looking for does not exist.</p>
                <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>{category.name} Events | Highland Events Hub</title>
                <meta name="description" content={`Discover the best ${category.name} events in the Scottish Highlands.`} />
            </Head>

            {/* Hero Section */}
            <div className="relative h-[40vh] min-h-[300px] bg-gray-900 overflow-hidden">
                {/* Background Image */}
                {category.image_url ? (
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${category.image_url})` }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-gray-900" />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50" />

                {/* Content */}
                <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                {category.name}
                            </h1>
                            {category.description && (
                                <p className="text-xl text-gray-200 max-w-2xl">
                                    {category.description}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleFollowToggle}
                            disabled={isFollowLoading}
                            className={`
                                flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all transform hover:scale-105
                                ${isFollowing
                                    ? 'bg-white text-emerald-700 hover:bg-gray-100'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg'
                                }
                            `}
                        >
                            {isFollowing ? (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Following
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Follow
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search Bar */}
                <div className="mb-8 -mt-16 relative z-10">
                    <DiscoveryBar
                        onSearch={handleSearch}
                        isLoading={isLoadingEvents}
                        initialFilters={initialFilters}
                        mode="embedded"
                        hideCategory={true}
                    />
                </div>

                {/* Events List */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
                        {!isLoadingEvents && !eventsError && (
                            <span className="text-gray-600">
                                {total} event{total !== 1 ? 's' : ''} found
                            </span>
                        )}
                    </div>

                    <EventList events={events} isLoading={isLoadingEvents} error={eventsError} />
                </div>
            </div>
        </div>
    );
}
