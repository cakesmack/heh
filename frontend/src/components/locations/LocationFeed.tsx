import React, { useState } from 'react';
import { EventResponse } from '@/types';
import { EventCard } from '@/components/events/EventCard';
import { eventsAPI } from '@/lib/api';

interface LocationFeedProps {
    initialEvents: EventResponse[];
    city: string;
}

const PAGE_SIZE = 24;

export function LocationFeed({ initialEvents, city }: LocationFeedProps) {
    const [events, setEvents] = useState<EventResponse[]>(initialEvents);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(initialEvents.length >= PAGE_SIZE);

    const loadMore = async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        try {
            const currentCount = events.length;
            const res = await eventsAPI.list({
                city_filter: city,
                limit: PAGE_SIZE,
                skip: currentCount,
                sort_by: 'date',
                time_range: 'upcoming'
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

    if (events.length === 0) {
        return null; // Parent component handles zero state
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                ))}
            </div>

            {hasMore && (
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
