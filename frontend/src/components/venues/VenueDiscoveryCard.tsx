import Link from 'next/link';
import Image from 'next/image';
import { VenueResponse } from '@/types';

interface VenueDiscoveryCardProps {
    venue: VenueResponse;
}

export function VenueDiscoveryCard({ venue }: VenueDiscoveryCardProps) {
    // Determine image source - use venue image or fallback
    const imageSrc = venue.image_url || '/images/placeholders/venue-placeholder.jpg';

    return (
        <Link href={`/venues/${venue.id}`} className="group block h-full">
            <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden h-full flex flex-col border border-gray-100">
                {/* Image Container */}
                <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
                    {venue.image_url ? (
                        <img
                            src={imageSrc}
                            alt={venue.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    )}

                    {/* Category Badge (if available) */}
                    {venue.category && (
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-gray-700 shadow-sm">
                            {venue.category.name}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-grow">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors line-clamp-1">
                        {venue.name}
                    </h3>

                    <div className="flex items-center text-gray-500 text-sm mb-3">
                        <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">
                            {venue.address}
                        </span>
                    </div>

                    {/* Stats / Info */}
                    <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
                        <span>
                            {venue.upcoming_events_count !== undefined ? (
                                <span className={venue.upcoming_events_count > 0 ? "text-emerald-600 font-medium" : ""}>
                                    {venue.upcoming_events_count} Upcoming Event{venue.upcoming_events_count !== 1 ? 's' : ''}
                                </span>
                            ) : (
                                "View Details"
                            )}
                        </span>


                    </div>
                </div>
            </div>
        </Link>
    );
}
