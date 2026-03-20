import React, { useState, useEffect, useMemo } from 'react';
import { EventResponse, Category } from '@/types';
import { EventCard } from '@/components/events/EventCard';
import { categoriesAPI } from '@/lib/api';
import { SingleDateRangePicker } from '@/components/ui/SingleDateRangePicker';

interface LocationFeedProps {
    initialEvents: EventResponse[];
    city: string;
}

const PAGE_SIZE = 24;

export function LocationFeed({ initialEvents, city }: LocationFeedProps) {
    // Filter State
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });

    // Client-side pagination state
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Fetch Categories on Mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await categoriesAPI.list(true);
                setCategories(res.categories || []);
            } catch (err) {
                console.error("Failed to load categories:", err);
            }
        };
        fetchCategories();
    }, []);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [selectedCategory, dateRange]);

    // Client-side filtered events (from the full SSR-fetched array)
    const filteredEvents = useMemo(() => {
        let result = initialEvents;

        // Category filter
        if (selectedCategory) {
            result = result.filter(event =>
                event.category?.slug === selectedCategory
            );
        }

        // Date range filter
        if (dateRange.from) {
            const from = dateRange.from.getTime();
            result = result.filter(event => {
                const eventEnd = new Date(event.date_end).getTime();
                return eventEnd >= from;
            });
        }
        if (dateRange.to) {
            const to = dateRange.to.getTime();
            result = result.filter(event => {
                const eventStart = new Date(event.date_start).getTime();
                return eventStart <= to;
            });
        }

        return result;
    }, [initialEvents, selectedCategory, dateRange]);

    // Paginated slice of filtered events
    const visibleEvents = filteredEvents.slice(0, visibleCount);
    const hasMore = visibleCount < filteredEvents.length;

    const loadMore = () => {
        setVisibleCount(prev => prev + PAGE_SIZE);
    };

    const isFiltering = selectedCategory !== '' || dateRange.from !== null || dateRange.to !== null;

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
                        {filteredEvents.length} results
                    </div>
                </div>
            </div>

            {/* Events Grid */}
            <div>
                {filteredEvents.length === 0 ? (
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
                        {visibleEvents.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </div>

            {/* Load More Button (client-side pagination) */}
            {hasMore && filteredEvents.length > 0 && (
                <div className="text-center pt-4">
                    <button
                        onClick={loadMore}
                        className="inline-flex items-center justify-center px-8 py-3 border border-emerald-200 text-base font-medium rounded-full text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 transition-colors shadow-sm"
                    >
                        Load More Events
                    </button>
                </div>
            )}
        </div>
    );
}
