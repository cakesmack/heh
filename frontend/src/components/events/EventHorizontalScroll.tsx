/**
 * EventHorizontalScroll
 * Horizontal scrollable container for event cards
 */

import { EventResponse } from '@/types';
import SmallEventCard from '@/components/events/SmallEventCard';

interface EventHorizontalScrollProps {
    events: EventResponse[];
    className?: string;
}

export default function EventHorizontalScroll({ events, className = '' }: EventHorizontalScrollProps) {
    if (events.length === 0) return null;

    return (
        <div
            className={`
        flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-4
        scrollbar-hide
        ${className}
      `}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
            {events.map((event) => (
                <div
                    key={event.id}
                    className="snap-start shrink-0 min-w-[280px] w-72"
                >
                    <SmallEventCard event={event} />
                </div>
            ))}
        </div>
    );
}
