/**
 * EventCard Component
 * Displays event information in a card format
 */

'use client';

import Link from 'next/link';
import { EventResponse } from '@/types';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { BookmarkButton } from '@/components/events/BookmarkButton';
import { stripHtml } from '@/lib/stringUtils';

interface EventCardProps {
  event: EventResponse;
}

export function EventCard({ event }: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      music: 'info',
      food: 'warning',
      art: 'success',
      sports: 'danger',
      culture: 'info',
      nightlife: 'danger',
      outdoors: 'success',
      family: 'warning',
      other: 'default',
    };
    return colors[category] || 'default';
  };

  return (
    <Link href={`/events/${event.id}`}>
      <Card hover padding="none" className="overflow-hidden">
        {/* Image */}
        {event.image_url && (
          <div className="relative h-48 bg-gray-200">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            {event.featured && (
              <div className="absolute top-2 left-2 z-10">
                <Badge variant="warning" size="sm">
                  ⭐ Featured
                </Badge>
              </div>
            )}
            <div className="absolute top-2 right-2 z-10">
              <BookmarkButton eventId={event.id} size="sm" className="shadow-sm" />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {/* Category */}
          {event.category && (
            <div className="mb-2">
              <Badge variant="default" size="sm">
                {event.category.name}
              </Badge>
            </div>
          )}

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 break-words">
            {event.title}
          </h3>

          {/* Description */}
          {event.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{stripHtml(event.description)}</p>
          )}

          {/* Meta Info */}
          <div className="space-y-1 text-sm text-gray-500">
            {/* Date/Time */}
            <div className="flex items-center flex-wrap gap-1">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {/* Case 1: Multiple showtimes (theatre runs) */}
              {event.showtimes && event.showtimes.length > 1 ? (() => {
                const firstDate = new Date(event.showtimes[0].start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const lastDate = new Date(event.showtimes[event.showtimes.length - 1].start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                return (
                  <>
                    <span>
                      {firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`}
                    </span>
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Multiple Showings
                    </span>
                  </>
                );
              })() : /* Case 2: Multi-day event (date_start and date_end on different days) */
                event.date_end && new Date(event.date_start).toDateString() !== new Date(event.date_end).toDateString() ? (() => {
                  const startDate = new Date(event.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  const endDate = new Date(event.date_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  return (
                    <span>
                      {startDate === endDate ? startDate : `${startDate} - ${endDate}`}
                    </span>
                  );
                })() : (
                  /* Case 3: Single day event */
                  <span>
                    {formatDate(event.date_start)} · {formatTime(event.date_start)}
                  </span>
                )}
              {event.is_recurring && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Weekly
                </span>
              )}
            </div>

            {/* Venue */}
            {event.venue_name && (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{event.venue_name}</span>
              </div>
            )}

            {/* Distance */}
            {event.distance_km !== undefined && event.distance_km !== null && (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <span>{event.distance_km.toFixed(1)} km away</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
            {/* Price */}
            <div className="text-sm font-medium text-gray-900">
              {event.price_display || (event.price === 0 ? 'Free' : `£${event.price.toFixed(2)}`)}
            </div>

            {/* Check-ins */}
            {event.checkin_count !== undefined && (
              <div className="text-sm text-gray-500">
                {event.checkin_count} check-in{event.checkin_count !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
