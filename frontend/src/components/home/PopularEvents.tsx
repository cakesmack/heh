/**
 * Popular Events Section
 * Netflix-style horizontal scroll with ranking numbers
 */

import { useEffect, useState } from 'react';
import { eventsAPI, searchAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import EventCardSkeleton from '@/components/events/EventCardSkeleton';
import Link from 'next/link';
import Image from 'next/image';

// Helper: Format event date with multi-day support
function formatEventDate(event: EventResponse): string {
    const formatShort = (date: Date) => date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

    // Case 1: Multiple showtimes
    if (event.showtimes && event.showtimes.length > 1) {
        const first = new Date(event.showtimes[0].start_time);
        const last = new Date(event.showtimes[event.showtimes.length - 1].start_time);
        const firstStr = formatShort(first);
        const lastStr = formatShort(last);
        // Only show range if dates are different
        return firstStr === lastStr ? firstStr : `${firstStr} - ${lastStr}`;
    }

    // Case 2: Multi-day span
    if (event.date_end && new Date(event.date_start).toDateString() !== new Date(event.date_end).toDateString()) {
        const startStr = formatShort(new Date(event.date_start));
        const endStr = formatShort(new Date(event.date_end));
        // Only show range if dates are different
        return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
    }

    // Case 3: Single day
    return formatShort(new Date(event.date_start));
}

export default function PopularEvents() {
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [trendingIds, setTrendingIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch top events by popularity score and trending IDs in parallel
                const [topData, trendingData] = await Promise.all([
                    eventsAPI.getTop(10),
                    searchAPI.trending(7)
                ]);

                setEvents(topData.events);
                setTrendingIds(trendingData);
            } catch (err) {
                console.error('Failed to fetch popular events:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <section className="py-6 bg-stone-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                    <h2 className="text-2xl font-bold text-white">🔥 Top 10 This Week</h2>
                </div>
                <div
                    className="flex overflow-x-auto snap-x snap-mandatory gap-2 pb-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                        <div key={i} className="snap-start shrink-0 w-64 first:ml-4 md:first:ml-[max(1rem,calc((100vw-80rem)/2+1rem))]">
                            <div className="aspect-[2/3] bg-stone-800 rounded-2xl animate-pulse" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (events.length === 0) return null;

    return (
        <section className="py-6 bg-stone-900">
            {/* Title in container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">🔥 Top 10 This Week</h2>
                <Link href="/events" className="text-amber-400 hover:text-amber-300 font-medium text-sm">
                    View All →
                </Link>
            </div>

            {/* Netflix-style Horizontal Scroll */}
            <div
                className="flex overflow-x-auto snap-x snap-mandatory gap-2 pb-4"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {events.map((event, index) => (
                    <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className={`snap-start shrink-0 w-64 group relative transition-all duration-500 hover:z-10 ${index === 0 ? 'ml-4 md:ml-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''} ${index === events.length - 1 ? 'mr-4 md:mr-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''}`}
                    >
                        {/* Card with Image */}
                        <div className="relative aspect-[2/3] rounded-xl md:rounded-none overflow-hidden bg-stone-800 shadow-2xl border border-white/5 group-hover:border-white/20 transition-all duration-500">
                            {event.image_url ? (
                                <Image
                                    src={event.image_url}
                                    alt={event.title}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out opacity-80 group-hover:opacity-100"
                                    sizes="256px"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-emerald-900 opacity-60" />
                            )}

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />

                            {/* Trending Badge */}
                            {trendingIds.includes(event.id.replace(/-/g, '')) && (
                                <div className="absolute top-3 right-3 z-20 animate-pulse">
                                    <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-tighter">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.334-.398-1.817a1 1 0 00-1.514-.857 4.028 4.028 0 00-1.174 1.4c-.353.664-.525 1.337-.525 1.91 0 1.264.474 2.333 1.242 3.074.771.74 1.862 1.254 3.137 1.254 1.254 0 2.333-.47 3.074-1.242.742-.771 1.254-1.862 1.254-3.137 0-.533-.051-1.083-.21-1.685-.25-.949-.68-2.008-1.226-3.075-.546-1.066-1.228-2.033-1.815-2.733a1.018 1.018 0 00-.103-.11z" clipRule="evenodd" />
                                        </svg>
                                        Trending
                                    </span>
                                </div>
                            )}

                            {/* Ranking Number - Subtle Top-Left */}
                            <div
                                className="absolute top-2 left-2 text-[4rem] font-black text-white/20 leading-none select-none pointer-events-none italic tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]"
                                style={{ WebkitTextStroke: '2px rgba(255,255,255,0.3)' }}
                            >
                                {index + 1}
                            </div>

                            {/* Title & Info */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-black to-transparent">
                                <p className="text-white font-bold text-lg line-clamp-2 leading-tight group-hover:text-amber-400 transition-colors duration-300">
                                    {event.title}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-amber-500 text-xs font-bold uppercase tracking-widest">
                                        {formatEventDate(event)}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <span className="text-gray-400 text-xs truncate">
                                        {event.venue_name || 'Various Locations'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}

