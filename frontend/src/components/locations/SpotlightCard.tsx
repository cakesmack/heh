import React from 'react';
import Link from 'next/link';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { EventResponse } from '@/types';
import { Badge } from '@/components/common/Badge';
import { stripHtml } from '@/lib/stringUtils';

interface SpotlightCardProps {
  event: EventResponse;
  label: 'Trending' | 'Up Next';
}

export function SpotlightCard({ event, label }: SpotlightCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
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

  const labelConfig = {
    Trending: {
      bg: 'bg-amber-500',
      text: 'text-amber-950',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 16.89 19.32C18.55 17.68 19.12 15.13 18.16 13C17.95 12.48 17.59 11.95 17.22 11.51L17.66 11.2Z" />
        </svg>
      ),
    },
    'Up Next': {
      bg: 'bg-emerald-500',
      text: 'text-emerald-950',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const config = labelConfig[label];

  return (
    <Link
      href={`/events/${event.slug || event.id}`}
      className="block group mb-8"
    >
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg border border-gray-100 transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5">
        <div className="flex flex-col md:flex-row">
          {/* Image */}
          <div className="relative w-full md:w-1/2 aspect-[16/9] md:aspect-auto md:h-80 bg-gray-200 flex-shrink-0 skeleton">
            {event.image_url ? (
              <OptimizedImage
                src={event.image_url}
                variant="hero"
                alt={event.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                <svg className="w-16 h-16 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}

            {/* Badge */}
            <div className="absolute top-4 left-4 z-10">
              <span className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} text-xs font-bold px-3 py-1.5 rounded-full shadow-md`}>
                {config.icon}
                {label}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col justify-center p-6 md:p-8 flex-1">
            {/* Category */}
            {event.category && (
              <div className="mb-3">
                <Badge variant="default" size="sm">
                  {event.category.name}
                </Badge>
              </div>
            )}

            <div className="min-h-[4rem] mb-3">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                {event.title}
              </h2>
            </div>

            <div className="min-h-[3rem] mb-4">
              {event.description && (
                <p className="text-gray-600 line-clamp-2 text-sm md:text-base">
                  {stripHtml(event.description)}
                </p>
              )}
            </div>

            {/* Meta */}
            <div className="space-y-2 text-sm text-gray-500 mb-5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{formatDate(event.date_start)} · {formatTime(event.date_start)}</span>
              </div>
              {event.venue_name && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{event.venue_name}</span>
                </div>
              )}
            </div>

            {/* Price + CTA */}
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-full text-sm group-hover:bg-emerald-700 transition-colors shadow-sm">
                View Event →
              </span>
              <span className="text-sm font-medium text-gray-700">
                {event.price_display || (event.price === 0 ? 'Free' : `£${event.price?.toFixed(2)}`)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
