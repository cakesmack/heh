import React from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { EventResponse } from '@/types';

interface MapEventCardProps {
    event: EventResponse;
    isSelected?: boolean;
    onClick?: () => void;
    onHover?: (isHovering: boolean) => void;
}

export default function MapEventCard({
    event,
    isSelected = false,
    onClick,
    onHover
}: MapEventCardProps) {
    // Format date
    const startDate = new Date(event.date_start);
    const dateStr = format(startDate, 'EEE, MMM d • h:mm a');

    return (
        <div
            id={`event-card-${event.id}`}
            className={`flex gap-4 p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${isSelected ? 'bg-emerald-50 border-emerald-100 ring-1 ring-inset ring-emerald-200' : 'bg-white'
                }`}
            onClick={onClick}
            onMouseEnter={() => onHover?.(true)}
            onMouseLeave={() => onHover?.(false)}
        >
            {/* Image */}
            <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                {event.image_url ? (
                    <Image
                        src={event.image_url}
                        alt={event.title}
                        fill
                        className="object-cover"
                        sizes="96px"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}
                {/* Category Badge */}
                {event.category && (
                    <div className="absolute top-0 left-0 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-br-lg">
                        <span className="text-[10px] font-medium text-white uppercase tracking-wide">
                            {event.category.name}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="text-xs font-medium text-emerald-600 mb-0.5">
                    {dateStr}
                </div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight mb-1 line-clamp-2">
                    {event.title}
                </h3>
                <div className="flex items-center text-xs text-gray-500 mb-2">
                    <svg className="w-3.5 h-3.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{event.venue_name || 'Unknown Venue'}</span>
                </div>

                {/* Price / Tags (Optional) */}
                <div className="flex items-center gap-2 mt-auto">
                    {event.ticket_url && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            Tickets
                        </span>
                    )}
                    <a
                        href={`/events/${event.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center"
                    >
                        View
                        <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    );
}
