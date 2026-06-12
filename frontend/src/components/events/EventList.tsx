'use client';

import { EventResponse } from '@/types';
import SmallEventCard from '@/components/events/SmallEventCard';
import { Spinner } from '@/components/common/Spinner';
import { EventCardSkeleton } from '@/components/events/EventCardSkeleton';

interface EventListProps {
  events: EventResponse[];
  isLoading: boolean;
  error?: string | null;
}

export function EventList({ events, isLoading, error }: EventListProps) {
  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="text-red-600 mb-2">
          <svg
            className="w-12 h-12 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-lg font-medium">Error loading events</p>
          <p className="text-sm text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const skeletonCount = 6;

  return (
    <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {isLoading ? (
        Array.from({ length: skeletonCount }).map((_, index) => (
          <EventCardSkeleton key={`skeleton-${index}`} />
        ))
      ) : events.length === 0 ? (
        <div className="col-span-full py-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900">No events found</p>
          <p className="text-sm text-gray-600 mt-2">
            Try adjusting your filters or check back later for new events.
          </p>
        </div>
      ) : (
        events.map((event) => (
          <SmallEventCard key={event.id} event={event} />
        ))
      )}
    </div>
  );
}
