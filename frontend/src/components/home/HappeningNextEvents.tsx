import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EventResponse } from '@/types';
import { EventCard } from '@/components/events/EventCard';
import { EventCardSkeleton } from '@/components/events/EventCardSkeleton';
import Link from 'next/link';

interface HappeningNextEventsProps {
    events: EventResponse[];
    isLoading: boolean;
}

export default function HappeningNextEvents({ events, isLoading }: HappeningNextEventsProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = 340; // Card width + gap
            current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (isLoading) {
        return (
            <section className="py-10 bg-gray-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                    <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-80 animate-pulse" />
                </div>
                <div
                    className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide px-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="shrink-0 w-72 sm:w-96 first:ml-4 md:first:ml-[max(1rem,calc((100vw-80rem)/2+1rem))]">
                            <div className="aspect-[16/9] bg-gray-200 rounded-xl animate-pulse mb-4" />
                            <div className="h-6 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
                            <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (events.length === 0) return null;

    return (
        <section className="py-10 bg-gray-50 border-b border-gray-100">
            {/* Header */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📅</span> Happening Next
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Upcoming events starting from now, ordered chronologically
                    </p>
                </div>
                <Link href="/events" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">
                    View All →
                </Link>
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
                    className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {events.map((event, index) => (
                        <div
                            key={event.id}
                            className={`snap-start shrink-0 w-72 sm:w-96 ${
                                index === 0 ? 'ml-4 md:ml-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''
                            } ${
                                index === events.length - 1 ? 'mr-4 md:mr-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''
                            }`}
                        >
                            <EventCard event={event} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
