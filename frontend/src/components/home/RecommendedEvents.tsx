import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { recommendationsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Compact card variant for recommended events - image and title only
function CompactEventCard({ event }: { event: EventResponse }) {
    return (
        <Link href={`/events/${event.slug || event.id}`} className="block group">
            <div className="relative overflow-hidden rounded-xl md:rounded-none">
                <div className="relative aspect-[4/3] overflow-hidden">
                    <OptimizedImage
                        src={event.image_url || '/images/event-placeholder.jpg'}
                        alt={event.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, 25vw"
                        variant="thumb"
                    />
                </div>
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {/* Title at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-emerald-300 transition-colors">
                        {event.title}
                    </h3>
                    {event.category && (
                        <span className="text-emerald-400 text-xs font-medium mt-1 block">
                            {event.category.name}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}

export default function RecommendedEvents() {
    const { isAuthenticated } = useAuth();
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = 300; // Roughly one card width + gap
            current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!isAuthenticated) {
                setLoading(false);
                return;
            }

            try {
                // Fetch 8 events
                const data = await recommendationsAPI.getRecommendations(8);
                setEvents(data);
            } catch (err) {
                console.error('Failed to fetch recommendations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [isAuthenticated]);

    if (!isAuthenticated) return null;

    if (loading) {
        return (
            <section className="py-12 bg-gray-50 border-t border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
                    <p className="text-gray-600 mt-1">Events based on your interests</p>
                </div>
                <div
                    className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide px-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="shrink-0 w-64 sm:w-72 first:ml-4 md:first:ml-[max(1rem,calc((100vw-80rem)/2+1rem))]">
                            <div className="aspect-[4/3] bg-gray-200 animate-pulse rounded-xl" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (events.length === 0) return null;

    return (
        <section className="py-12 bg-gray-50 border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
                <p className="text-gray-600 mt-1">Events based on your interests</p>
            </div>

            {/* Scroll Wrapper */}
            <div className="relative group">
                {/* Left Scroll Button (Desktop Only) */}
                <button
                    onClick={() => scroll('left')}
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 text-stone-900 p-2.5 rounded-full shadow-md hover:bg-white hover:scale-110 transition-all ml-4 opacity-0 group-hover:opacity-100 focus:opacity-100 border border-gray-100"
                    aria-label="Scroll left"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Right Scroll Button (Desktop Only) */}
                <button
                    onClick={() => scroll('right')}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 text-stone-900 p-2.5 rounded-full shadow-md hover:bg-white hover:scale-110 transition-all mr-4 opacity-0 group-hover:opacity-100 focus:opacity-100 border border-gray-100"
                    aria-label="Scroll right"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                {/* Scrollable Row */}
                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {events.slice(0, 8).map((event, index) => (
                        <div
                            key={event.id}
                            className={`snap-start shrink-0 w-64 sm:w-72 ${
                                index === 0 ? 'ml-4 md:ml-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''
                            } ${
                                index === Math.min(events.length, 8) - 1 ? 'mr-4 md:mr-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''
                            }`}
                        >
                            <CompactEventCard event={event} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
