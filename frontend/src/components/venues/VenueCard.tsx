/**
 * VenueCard Component
 * Displays venue information in a card format
 */

'use client';

import Link from 'next/link';
import { VenueResponse } from '@/types';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';

interface VenueCardProps {
  venue: VenueResponse;
}

export function VenueCard({ venue }: VenueCardProps) {
  const getCategoryColor = (categorySlug?: string) => {
    if (!categorySlug) return 'default';

    const colors: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      pub: 'warning',
      restaurant: 'info',
      hotel: 'success',
      museum: 'info',
      gallery: 'success',
      theatre: 'danger',
      outdoor: 'success',
      other: 'default',
    };
    return colors[categorySlug.toLowerCase()] || 'default';
  };

  return (
    <Link href={`/venues/${venue.id}`}>
      <Card hover padding="md">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{venue.name}</h3>
            <Badge variant={getCategoryColor(venue.category?.slug)} size="sm">
              {venue.category?.name || 'Unknown Category'}
            </Badge>
          </div>
        </div>

        {/* Description */}
        {venue.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{venue.description}</p>
        )}

        {/* Info */}
        <div className="space-y-2 text-sm text-gray-500">
          {/* Address */}
          <div className="flex items-start">
            <svg
              className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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
            <span className="line-clamp-1">{venue.address}</span>
          </div>



          {/* Distance */}
          {venue.distance_km !== undefined && venue.distance_km !== null && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>{venue.distance_km.toFixed(1)} km away</span>
            </div>
          )}

          {/* Website */}
          {venue.website && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              <span className="text-emerald-600 hover:underline truncate">Website</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {venue.upcoming_events_count !== undefined && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              {venue.upcoming_events_count} upcoming event
              {venue.upcoming_events_count !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </Card>
    </Link>
  );
}
