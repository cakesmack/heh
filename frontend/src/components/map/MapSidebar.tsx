import React from 'react';
import { format, startOfDay } from 'date-fns';
import { EventResponse } from '@/types';
import MapEventCard from './MapEventCard';

interface MapSidebarProps {
    events: EventResponse[];
    loading: boolean;
    error: string | null;
    selectedMarkerId?: string;
    hoveredEventId: string | null;
    onEventClick: (event: EventResponse) => void;
    onHover: (eventId: string | null) => void;
}

export default function MapSidebar({
    events,
    loading,
    error,
    selectedMarkerId,
    hoveredEventId,
    onEventClick,
    onHover
}: MapSidebarProps) {
    if (loading) {
        return (
            <div className="p-8 text-center flex-1">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent mx-auto mb-4" />
                <p className="text-gray-500">Loading events...</p>
            </div>
        );
    }

    if (error) {
        return <div className="p-8 text-center text-red-500 flex-1">{error}</div>;
    }

    if (events.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 flex-1">
                <p className="text-lg font-medium mb-2">No events found</p>
                <p className="text-sm">Try selecting a different date or category.</p>
            </div>
        );
    }

    // Group events by date (using startOfDay string as key)
    const groupedEvents: Record<string, EventResponse[]> = {};
    const sortedDates: string[] = [];

    events.forEach(event => {
        if (!event.date_start) return;
        const dateKey = startOfDay(new Date(event.date_start)).toISOString();
        if (!groupedEvents[dateKey]) {
            groupedEvents[dateKey] = [];
            sortedDates.push(dateKey);
        }
        groupedEvents[dateKey].push(event);
    });

    sortedDates.sort(); // Ensure chronological order

    return (
        <aside className="hidden lg:flex lg:flex-col lg:w-[380px] xl:w-[420px] flex-shrink-0 overflow-y-auto bg-gray-50 border-r border-gray-200">
            {sortedDates.map(dateKey => {
                const dateObj = new Date(dateKey);
                // Header Format: "Wednesday, Jan 15"
                const dateLabel = format(dateObj, 'EEEE, MMM d');
                const isToday = new Date().toDateString() === dateObj.toDateString();

                return (
                    <div key={dateKey}>
                        {/* Sticky Date Header */}
                        <div className="sticky top-0 z-10 bg-gray-100/95 backdrop-blur-sm px-4 py-2 border-y border-gray-200 shadow-sm flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900">
                                {dateLabel}
                            </h3>
                            {isToday && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    TODAY
                                </span>
                            )}
                        </div>

                        {/* Event List for this Date */}
                        <div className="divide-y divide-gray-100">
                            {groupedEvents[dateKey].map(event => (
                                <MapEventCard
                                    key={event.id}
                                    event={event}
                                    isSelected={selectedMarkerId === event.id}
                                    onClick={() => onEventClick(event)}
                                    onHover={(isHovering) => onHover(isHovering ? event.id : null)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </aside>
    );
}
