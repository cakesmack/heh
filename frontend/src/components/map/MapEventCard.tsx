import React from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { EventResponse } from '@/types';
import { getOptimizedImage } from '@/lib/images';

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
    const month = format(startDate, 'MMM').toUpperCase();
    const day = format(startDate, 'd');
    const time = format(startDate, 'h:mm a');
    const isToday = new Date().toDateString() === startDate.toDateString();

    return (
        <div
            id={`event-card-${event.id}`}
            className={`flex gap-3 p-3 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 group ${isSelected ? 'bg-emerald-50 border-emerald-100 ring-1 ring-inset ring-emerald-200' : 'bg-white'
                }`}
            onClick={onClick}
            onMouseEnter={() => onHover?.(true)}
            onMouseLeave={() => onHover?.(false)}
        >
            {/* Left: Calendar Icon Visual */}
            <div className="flex-shrink-0 flex flex-col w-12 h-14 rounded-lg overflow-hidden border border-gray-200 shadow-sm text-center bg-white self-start mt-1">
                <div className="bg-red-600 text-[10px] font-bold text-white py-0.5 tracking-wider">
                    {month}
                </div>
                <div className="flex-1 flex items-center justify-center font-bold text-xl text-gray-900 leading-none pb-1">
                    {day}
                </div>
            </div>

            {/* Right: Content */}
            <div className="flex-1 min-w-0">
                {/* Image + Title Row */}
                <div className="flex gap-3 mb-1">
                    <div className="flex-1 min-w-0">
                        {/* Optional: Today Badge */}
                        {isToday && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 mb-1 animate-pulse">
                                HAPPENING TODAY
                            </span>
                        )}
                        <h3 className="text-sm font-bold text-gray-900 leading-tight line-clamp-2group-hover:text-emerald-700 transition-colors">
                            {event.title}
                        </h3>
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-0.5">
                    <div className="text-xs text-emerald-700 font-medium">
                        {time}
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                        <svg className="w-3 h-3 mr-1 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{event.venue_name || 'Unknown Venue'}</span>
                    </div>
                </div>

                {/* Footer Actions (Optional) */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
                    {event.ticket_url && (
                        <span className="text-[10px] font-medium text-gray-400">
                            Tickets Available
                        </span>
                    )}
                    <span className="ml-auto text-xs font-semibold text-emerald-600 flex items-center group-hover:underline">
                        Details
                        <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </div>
        </div>
    );
}
