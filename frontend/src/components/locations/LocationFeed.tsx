import React, { useState, useEffect } from 'react';
import { EventResponse } from '@/types';
import { EventCard } from '@/components/events/EventCard';
import { eventsAPI } from '@/lib/api';

interface LocationFeedProps {
    initialEvents: EventResponse[];
    city: string;
}

const PAGE_SIZE = 24;

const CATEGORIES = [
    { label: 'All Categories', value: '' },
    { label: 'Music', value: 'Music' },
    { label: 'Sport', value: 'Sport' },
    { label: 'Arts', value: 'Arts' },
    { label: 'Family', value: 'Family' },
    { label: 'Nightlife', value: 'Nightlife' },
    { label: 'Community', value: 'Community' },
];

const DATE_FILTERS = [
    { label: 'Any Date', value: 'upcoming' },
    { label: 'Today', value: 'today' },
    { label: 'Tomorrow', value: 'tomorrow' },
    { label: 'This Weekend', value: 'this_weekend' },
];

export function LocationFeed({ initialEvents, city }: LocationFeedProps) {
    const [events, setEvents] = useState<EventResponse[]>(initialEvents);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(initialEvents.length >= PAGE_SIZE);

    // Filter State
    const [selectedCategory, setSelectedCategory] = useState('');
    const [dateFilter, setDateFilter] = useState('upcoming');
    const [isFiltering, setIsFiltering] = useState(false);

    // Fetch when filters change
    useEffect(() => {
        // Skip first render if it matches initial state (though initialEvents might be diverse)
        // Actually, we want to fetch if the user interacts. 
        // But initially we have 'initialEvents' passed from server.
        // If we change filter, we must re-fetch.

        const fetchFilteredEvents = async () => {
            setIsFiltering(true);
            setLoading(true);
            try {
                const res = await eventsAPI.list({
                    city_filter: city,
                    category: (selectedCategory as any) || undefined,
                    time_range: (dateFilter as any),
                    limit: PAGE_SIZE,
                    skip: 0,
                    sort_by: 'date'
                });

                setEvents(res.events);
                setHasMore(res.events.length >= PAGE_SIZE);
            } catch (error) {
                console.error("Failed to filter events:", error);
            } finally {
                setLoading(false);
                setIsFiltering(false);
            }
        };

        // Avoid fetching on mount if we assume initialEvents are "default" filtered.
        // However, if initialProps has 'upcoming' and empty category... 
        // We can track if it's the *initial* mount or a change.
        // For simplicity, let's just fetch if state differs from "default default" OR just fetch on change.
        // Actually, preventing double fetch on mount is good.
        // But checking `isFiltering` flag is safer to debounce visually.

        // We'll stick to a simple check: if we are NOT using the props anymore (which we aren't after first render + change), fetch.
        // A standard approach is a ref `isMounted`.

    }, [selectedCategory, dateFilter, city]); // Add proper dep array handling below

    // We need a ref to skip the initial fetch because `initialEvents` is already there.
    const isMounted = React.useRef(false);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const fetchData = async () => {
            setIsFiltering(true);
            // Reset list to show loading state if desired, or keep old list until new one arrives
            // setEvents([]); // Optional: clear to show spinner

            try {
                const res = await eventsAPI.list({
                    city_filter: city,
                    category: (selectedCategory as any) || undefined,
                    time_range: (dateFilter as any),
                    limit: PAGE_SIZE,
                    skip: 0,
                    sort_by: 'date'
                });
                setEvents(res.events);
                setHasMore(res.events.length >= PAGE_SIZE);
            } catch (err) {
                console.error(err);
            } finally {
                setIsFiltering(false);
            }
        };

        fetchData();
    }, [selectedCategory, dateFilter, city]);


    const loadMore = async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        try {
            const currentCount = events.length;
            const res = await eventsAPI.list({
                city_filter: city,
                category: (selectedCategory as any) || undefined,
                time_range: (dateFilter as any),
                limit: PAGE_SIZE,
                skip: currentCount,
                sort_by: 'date'
            });

            const newEvents = res.events;

            if (newEvents.length < PAGE_SIZE) {
                setHasMore(false);
            }

            if (newEvents.length > 0) {
                setEvents(prev => [...prev, ...newEvents]);
            }
        } catch (error) {
            console.error("Failed to load more events:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    {/* Category Dropdown */}
                    <div className="relative">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="appearance-none w-full md:w-48 bg-gray-50 border border-gray-200 text-gray-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-500 cursor-pointer"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>

                    {/* Date Dropdown */}
                    <div className="relative">
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="appearance-none w-full md:w-48 bg-gray-50 border border-gray-200 text-gray-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-500 cursor-pointer"
                        >
                            {DATE_FILTERS.map(date => (
                                <option key={date.value} value={date.value}>{date.label}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

                <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                    {events.length} results
                </div>
            </div>

            {/* Events Grid */}
            <div className={`transition-opacity duration-300 ${isFiltering ? 'opacity-50' : 'opacity-100'}`}>
                {events.length === 0 && !isFiltering ? (
                    <div className="text-center py-20">
                        <p className="text-gray-500 text-lg">No events match your selected filters.</p>
                        <button
                            onClick={() => { setSelectedCategory(''); setDateFilter('upcoming'); }}
                            className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </div>

            {/* Load More Button */}
            {hasMore && !isFiltering && events.length > 0 && (
                <div className="text-center pt-4">
                    <button
                        onClick={loadMore}
                        disabled={loading}
                        className="inline-flex items-center justify-center px-8 py-3 border border-emerald-200 text-base font-medium rounded-full text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading Events...
                            </>
                        ) : 'Load More Events'}
                    </button>
                </div>
            )}
        </div>
    );
}
