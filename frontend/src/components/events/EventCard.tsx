'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { EventResponse } from '@/types';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { BookmarkButton } from '@/components/events/BookmarkButton';
import { stripHtml } from '@/lib/stringUtils';
import { optimizeCloudinaryUrl } from '@/utils/imageOptimizer';
import { useAuth } from '@/hooks/useAuth';

interface EventCardProps {
  event: EventResponse;
  canManage?: boolean;
}

export function EventCard({ event, canManage = false }: EventCardProps) {
  const { user } = useAuth();

  const hasEditRights = canManage || (user && (
    user.is_admin ||
    user.id === event.organizer_id ||
    (event.venue_owner_id && user.id === event.venue_owner_id) ||
    (event.organizer_profile_id && user.organizer_profiles?.some(p => p.id === event.organizer_profile_id))
  ));

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
    <Card hover padding="none" className="group relative overflow-hidden h-full flex flex-col">
      {/* Main Link Overlay */}
      <Link href={`/events/${event.id}`} className="absolute inset-0 z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500" aria-label={`View ${event.title}`}>
        <span className="sr-only">View Event</span>
      </Link>

      {/* Image */}
      {event.image_url && (
        <div className="relative h-48 bg-gray-200">
          <Image
            src={optimizeCloudinaryUrl(event.image_url, 600)}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
          {event.featured && (
            <div className="absolute top-2 left-2 z-20">
              <Badge variant="warning" size="sm">
                ⭐ Featured
              </Badge>
            </div>
          )}

          {/* Action Buttons (Z-20 to sit above link overlay) */}
          <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
            <BookmarkButton eventId={event.id} size="sm" className="shadow-sm bg-white hover:bg-gray-100 text-gray-700" />

            {hasEditRights && (
              <>
                <Link
                  href={`/events/${event.id}/edit`}
                  className="p-1.5 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow-sm transition-colors flex items-center justify-center"
                  title="Edit Event"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </Link>
                <Link
                  href={`/social/${event.id}`}
                  className="p-1.5 bg-indigo-600/90 hover:bg-indigo-700 text-white rounded-full shadow-sm transition-colors flex items-center justify-center"
                  title="Create Poster"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Category */}
        {event.category && (
          <div className="mb-2 relative z-0">
            {/* z-0 so it's under the link overlay? Actually link overlay is z-10 everywhere. */}
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
        <div className="space-y-1 text-sm text-gray-500 mt-auto">
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
              event.date_end &&
                new Date(event.date_start).toDateString() !== new Date(event.date_end).toDateString() &&
                !event.is_recurring ? (() => {
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
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="Recurring Event">
                <svg className="h-3 w-3 md:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden md:inline">Recurring</span>
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

          {/* Claim Event Button (Only for non-owners) */}
          {user && !hasEditRights && !event.organizer_id && (
            <Link href={`/events/${event.id}/claim`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              Claim Event
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

