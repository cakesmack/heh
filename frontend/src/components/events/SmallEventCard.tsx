/**
 * SmallEventCard Component
 * A compact event card for the search results drawer.
 * Fixed aspect ratio 3/4.
 */
import Link from 'next/link';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { EventResponse } from '@/types';
import { BookmarkButton } from '@/components/events/BookmarkButton';
import { toast } from 'react-hot-toast';

interface SmallEventCardProps {
    event: EventResponse;
}

export default function SmallEventCard({ event }: SmallEventCardProps) {
    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/events/${event.slug || event.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: event.title,
                    text: event.title,
                    url: shareUrl,
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Error sharing:', err);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Link copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy:', err);
                toast.error('Failed to copy link');
            }
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
        });
    };

    return (
        <Link href={`/events/${event.slug || event.id}`} className="group block h-full">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-dark shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1">
                {/* Image Background */}
                {event.image_url ? (
                    <OptimizedImage
                        src={event.image_url}
                        alt={event.title}
                        fill
                        className="object-cover transition-transform duration-700 ease-in-out group-hover:scale-110"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        variant="thumb"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-stone-900 flex items-center justify-center">
                        <span className="text-emerald-100/20 text-4xl font-bold">HEH</span>
                    </div>
                )}

                <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col gap-2">
                    <BookmarkButton eventId={event.id} size="sm" className="bg-white/90 hover:bg-white shadow-sm" />
                    <button
                        onClick={handleShare}
                        className="p-1.5 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                        title="Share Event"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                </div>

                {/* Gradient Overlay - Matches MagazineGrid */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 transition-opacity duration-700 ease-in-out group-hover:opacity-40" />

                {/* Glass Content Box - Matches MagazineGrid */}
                <div className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-stone-dark/60 p-4 border-t border-white/10 shadow-[0_-4px_30px_rgba(0,0,0,0.1)] transition-all duration-700 ease-in-out transform translate-y-0">

                    {/* Date & Category */}
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                            {/* Multi-day: show range (only if different), Single day: show date */}
                            {event.showtimes && event.showtimes.length > 1 ? (() => {
                                const firstDate = formatDate(event.showtimes[0].start_time);
                                const lastDate = formatDate(event.showtimes[event.showtimes.length - 1].start_time);
                                return firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;
                            })() : event.date_end &&
                                new Date(event.date_start).toDateString() !== new Date(event.date_end).toDateString() &&
                                !event.is_recurring ? (() => {
                                    const startDate = formatDate(event.date_start);
                                    const endDate = formatDate(event.date_end);
                                    return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
                                })() : (
                                formatDate(event.date_start)
                            )}
                        </span>
                        {event.category && (
                            <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                                style={{
                                    backgroundColor: `${event.category.gradient_color || '#10b981'}20`,
                                    color: event.category.gradient_color || '#10b981',
                                }}
                            >
                                <span
                                    className="w-1 h-1 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: event.category.gradient_color || '#10b981' }}
                                />
                                {event.category.name}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <div className="min-h-[2.5rem] mb-1">
                        <h3 className="text-lg font-bold text-white leading-tight text-shadow-sm line-clamp-2 group-hover:text-emerald-300 transition-colors">
                            {event.title}
                        </h3>
                    </div>

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
