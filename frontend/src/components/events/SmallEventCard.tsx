/**
 * SmallEventCard Component
 * A compact event card for the search results drawer.
 * Fixed aspect ratio 3/4.
 */
import Link from 'next/link';
import Image from 'next/image';
import { EventResponse } from '@/types';
import { BookmarkButton } from '@/components/events/BookmarkButton';

interface SmallEventCardProps {
    event: EventResponse;
}

export default function SmallEventCard({ event }: SmallEventCardProps) {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
        });
    };

    return (
        <Link href={`/events/${event.id}`} className="group block h-full">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-dark shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1">
                {/* Image Background */}
                {event.image_url ? (
                    <Image
                        src={event.image_url}
                        alt={event.title}
                        fill
                        className="object-cover transition-transform duration-700 ease-in-out group-hover:scale-110"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-stone-900 flex items-center justify-center">
                        <span className="text-emerald-100/20 text-4xl font-bold">HEH</span>
                    </div>
                )}

                <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <BookmarkButton eventId={event.id} size="sm" className="bg-white/90 hover:bg-white shadow-sm" />
                </div>

                {/* Gradient Overlay - Matches MagazineGrid */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 transition-opacity duration-700 ease-in-out group-hover:opacity-40" />

                {/* Glass Content Box - Matches MagazineGrid */}
                <div className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-stone-dark/60 p-4 border-t border-white/10 shadow-[0_-4px_30px_rgba(0,0,0,0.1)] transition-all duration-700 ease-in-out transform translate-y-0">

                    {/* Date & Category */}
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                            {/* Multi-day: show range, Single day: show date */}
                            {event.showtimes && event.showtimes.length > 1 ? (
                                <>
                                    {formatDate(event.showtimes[0].start_time)}
                                    {' - '}
                                    {formatDate(event.showtimes[event.showtimes.length - 1].start_time)}
                                </>
                            ) : event.date_end && new Date(event.date_start).toDateString() !== new Date(event.date_end).toDateString() ? (
                                <>
                                    {formatDate(event.date_start)}
                                    {' - '}
                                    {formatDate(event.date_end)}
                                </>
                            ) : (
                                formatDate(event.date_start)
                            )}
                        </span>
                        {event.category && (
                            <span className="text-gray-300 text-[10px] font-bold uppercase tracking-wider opacity-80">
                                {event.category.name}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-white mb-1 leading-tight text-shadow-sm line-clamp-2 group-hover:text-emerald-300 transition-colors">
                        {event.title}
                    </h3>

                    {/* Venue */}
                    {event.venue_name && (
                        <div className="flex items-center text-gray-300 text-xs mt-1">
                            <svg className="w-3 h-3 mr-1 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate opacity-80">{event.venue_name}</span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
