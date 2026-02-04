import React, { useState, useEffect } from 'react';
import { EventResponse, Category } from '@/types';
import { EventCard } from '@/components/events/EventCard';
import { eventsAPI, categoriesAPI } from '@/lib/api';
import { SingleDateRangePicker } from '@/components/ui/SingleDateRangePicker';

interface LocationFeedProps {
    initialEvents: EventResponse[];
    city: string;
}

const PAGE_SIZE = 24;

export function LocationFeed({ initialEvents, city }: LocationFeedProps) {
    const [events, setEvents] = useState<EventResponse[]>(initialEvents);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(initialEvents.length >= PAGE_SIZE);

    // Filter State
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');

    // Date State (Unified)
    const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });

    const [isFiltering, setIsFiltering] = useState(false);

    // Fetch Categories on Mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await categoriesAPI.list(true); // Active only
                setCategories(res.categories || []);
            } catch (err) {
                console.error("Failed to load categories:", err);
            }
        };
        fetchCategories();
    }, []);

    // Helper to build API params
    const buildParams = (skipVal: number) => {
        const params: any = {
            city_filter: city,
            category: selectedCategory || undefined,
            limit: PAGE_SIZE,
            skip: skipVal,
            sort_by: 'date'
        };

        if (dateRange.from) {
            params.date_from = dateRange.from.toISOString();
        }
        if (dateRange.to) {
            params.date_to = dateRange.to.toISOString();
        }
        // If no date range, backend defaults to "upcoming" (now onwards) automatically due to our previous refactor logic?
        // Wait, previous backend logic: "if not date_from and not date_to... default upcoming". Yes.

        return params;
    };

    // Fetch when filters change
    useEffect(() => {
        const fetchFilteredEvents = async () => {
            setIsFiltering(true);
            setLoading(true);
            try {
                const params = buildParams(0);
                const res = await eventsAPI.list(params);

                setEvents(res.events);
                setHasMore(res.events.length >= PAGE_SIZE);
            } catch (error) {
                console.error("Failed to filter events:", error);
            } finally {
                setLoading(false);
                setIsFiltering(false);
            }
        };

        const isMounted = React.useRef(false);
        if (isMounted.current) {
            fetchFilteredEvents();
        } else {
            isMounted.current = true;
        }

    }, [selectedCategory, dateRange, city]);


    const loadMore = async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        try {
            const currentCount = events.length;
            const params = buildParams(currentCount);
            const res = await eventsAPI.list(params);

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
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 w-full justify-between items-center">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                        {/* Category Dropdown */}
                        <div className="relative w-full md:w-auto">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="appearance-none w-full md:w-56 bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-4 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-500 cursor-pointer text-sm font-medium"
                            >
                                <option value="">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>

                        {/* Single Date Range Picker */}
                        <div className="w-full md:w-auto">
                            <SingleDateRangePicker
                                dateFrom={dateRange.from}
                                dateTo={dateRange.to}
                                onChange={setDateRange}
                            />
                        </div>
                    </div>

                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap hidden md:block">
                        {events.length} results
                    </div>
                </div>
            </div>

            {/* Events Grid */}
            <div className={`transition-opacity duration-300 ${isFiltering ? 'opacity-50' : 'opacity-100'}`}>
                {events.length === 0 && !isFiltering ? (
                    <div className="text-center py-20">
                        <p className="text-gray-500 text-lg">No events match your selected filters.</p>
                        <button
                            onClick={() => { setSelectedCategory(''); setDateRange({ from: null, to: null }); }}
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
