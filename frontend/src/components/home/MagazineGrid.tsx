import { useState, useEffect } from 'react';
import Link from 'next/link';
import { EventResponse } from '@/types';
import { Button } from '@/components/common/Button';
import { BookmarkButton } from '@/components/events/BookmarkButton';
import { stripHtml } from '@/lib/stringUtils';

// Helper: Format event date with multi-day support
function formatEventDate(event: EventResponse, options?: { long?: boolean }): string {
    const formatShort = (date: Date) => date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    const formatLong = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Case 1: Multiple showtimes
    if (event.showtimes && event.showtimes.length > 1) {
        const first = new Date(event.showtimes[0].start_time);
        const last = new Date(event.showtimes[event.showtimes.length - 1].start_time);
        const firstStr = formatShort(first);
        const lastStr = formatShort(last);
        // Only show range if dates are different
        return firstStr === lastStr ? firstStr : `${firstStr} - ${lastStr}`;
    }

    // Case 2: Multi-day span (date_start differs from date_end)
    if (event.date_end && new Date(event.date_start).toDateString() !== new Date(event.date_end).toDateString()) {
        const start = new Date(event.date_start);
        const end = new Date(event.date_end);
        const startStr = formatShort(start);
        const endStr = formatShort(end);
        // Only show range if dates are different
        return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
    }

    // Case 3: Single day
    const date = new Date(event.date_start);
    return options?.long ? formatLong(date) : formatShort(date);
}

interface MagazineGridProps {
    events: EventResponse[];
    carouselEvents?: EventResponse[];  // Up to 3 featured events for carousel
    title?: string;
    subtitle?: string;
    hideHeader?: boolean;
    hideFooter?: boolean;
}

const TileOverlay = ({ title, category, date, description, venue, checkins, categoryColor }: {
    title: string,
    category?: string,
    date: string,
    description?: string,
    venue?: string,
    checkins?: number,
    categoryColor?: string
}) => (
    <>
        {/* Category Ribbon */}
        {category && (
            <div className="absolute top-4 right-[-2px] z-20">
                <div
                    className="relative px-3 py-1 text-white text-xs font-bold uppercase tracking-wider shadow-md"
                    style={{ backgroundColor: categoryColor || '#10b981' }}
                >
                    {category}
                    {/* Ribbon Fold */}
                    <div
                        className="absolute top-full right-0 w-[4px] h-[4px] brightness-75"
                        style={{
                            backgroundColor: categoryColor || '#10b981',
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)'
                        }}
                    />
                </div>
            </div>
        )}

        <div className="absolute inset-0 flex flex-col justify-end">
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 transition-opacity duration-700 ease-in-out group-hover:opacity-40" />

            {/* Glass Content Box - Compact */}
            <div className="relative z-10 backdrop-blur-md bg-stone-dark/60 p-4 border-t border-white/10 shadow-[0_-4px_30px_rgba(0,0,0,0.1)] transition-all duration-700 ease-in-out transform translate-y-0">
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider block mb-1">{date}</span>

                <h3 className="text-lg md:text-xl font-bold text-white leading-tight text-shadow-sm line-clamp-2">
                    {title}
                </h3>

                {/* Hover: Venue & Checkins */}
                <div className="h-0 overflow-hidden group-hover:h-auto group-hover:mt-2 transition-all duration-300">
                    <div className="flex items-center text-gray-200 text-sm">
                        <svg className="w-4 h-4 mr-1 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <span className="truncate">{venue || 'TBA'}</span>
                    </div>
                </div>
            </div>
        </div>
    </>
);

export default function MagazineGrid({
    events,
    carouselEvents = [],
    title = "Latest Events",
    subtitle = "Discover what's happening now",
    hideHeader = false,
    hideFooter = false
}: MagazineGridProps) {
    // Carousel state
    const [carouselIndex, setCarouselIndex] = useState(0);
    const featuredEvents = carouselEvents.length > 0 ? carouselEvents.slice(0, 3) : [events[0]].filter(Boolean);

    // Auto-rotate carousel every 5 seconds
    useEffect(() => {
        if (featuredEvents.length <= 1) return;
        const interval = setInterval(() => {
            setCarouselIndex((prev) => (prev + 1) % featuredEvents.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [featuredEvents.length]);

    if (!events || events.length === 0) {
        return null;
    }

    // Grid items exclude carousel events to avoid duplicates - need 10 items to fill grid
    const carouselIds = new Set(featuredEvents.map(e => e.id));
    const gridItems = events.filter(e => !carouselIds.has(e.id)).slice(0, 12);

    return (
        <section className="w-full bg-stone-dark">
            {/* Header */}
            {!hideHeader && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{title}</h2>
                    <p className="text-gray-400 text-lg">{subtitle}</p>
                </div>
            )}

            {/* Mobile View: Vertical Card List */}
            <div className="md:hidden flex flex-col gap-4 px-4 py-4">
                {events.map((event) => (
                    <Link key={event.id} href={`/events/${event.id}`} className="block">
                        <div className="relative h-48 rounded-xl overflow-hidden shadow-sm bg-stone-800 group hover:scale-[1.02] transition-transform duration-300">
                            {/* Background Image */}
                            <img
                                src={event.image_url || '/images/event-placeholder.jpg'}
                                alt={event.title}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {/* Category Ribbon */}
                            {event.category && (
                                <div className="absolute top-3 right-[-2px] z-20">
                                    <div
                                        className="relative px-2 py-0.5 text-white text-[10px] font-bold uppercase tracking-wider shadow-md"
                                        style={{ backgroundColor: event.category.gradient_color || '#10b981' }}
                                    >
                                        {event.category.name}
                                        <div
                                            className="absolute top-full right-0 w-[3px] h-[3px] brightness-75"
                                            style={{
                                                backgroundColor: event.category.gradient_color || '#10b981',
                                                clipPath: 'polygon(0 0, 100% 0, 0 100%)'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            {/* Blurred Glass Overlay at Bottom */}
                            <div className="absolute inset-x-0 bottom-0 backdrop-blur-md bg-black/50 p-3 border-t border-white/10">
                                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider block mb-0.5">
                                    {formatEventDate(event)}
                                </span>
                                <h3 className="text-white font-bold text-base leading-tight line-clamp-1">
                                    {event.title}
                                </h3>
                                {event.venue_name && (
                                    <p className="text-gray-300 text-xs mt-0.5 truncate flex items-center">
                                        <svg className="w-3 h-3 mr-1 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                        {event.venue_name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Desktop View: Full Width Grid */}
            <div className="hidden md:grid w-full grid-cols-2 lg:grid-cols-4 gap-0">
                {/* Main Feature Carousel - Spans 2 cols and 2 rows on large screens */}
                <div className="lg:col-span-2 lg:row-span-2 relative group h-[500px] lg:h-[600px] overflow-hidden">
                    {/* Carousel Slides */}
                    <div className="relative w-full h-full">
                        {featuredEvents.map((event, index) => (
                            <div
                                key={event.id}
                                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === carouselIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                                    }`}
                            >
                                <Link href={`/events/${event.id}`} className="block w-full h-full relative">
                                    <img
                                        src={event.image_url || '/images/event-placeholder.jpg'}
                                        alt={event.title}
                                        className="w-full h-full object-cover transition-transform duration-1000 ease-in-out group-hover:scale-105"
                                    />

                                    {/* Category Ribbon */}
                                    {event.category && (
                                        <div className="absolute top-6 right-[-2px] z-20">
                                            <div
                                                className="relative px-4 py-1.5 text-white text-sm font-bold uppercase tracking-wider shadow-md"
                                                style={{ backgroundColor: event.category.gradient_color || '#059669' }}
                                            >
                                                {event.category.name}
                                                <div
                                                    className="absolute top-full right-0 w-[4px] h-[4px] brightness-75"
                                                    style={{
                                                        backgroundColor: event.category.gradient_color || '#059669',
                                                        clipPath: 'polygon(0 0, 100% 0, 0 100%)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute top-6 left-6 z-20">
                                        <BookmarkButton eventId={event.id} size="lg" className="bg-white/90 hover:bg-white shadow-lg" />
                                    </div>

                                    <div className="absolute inset-0 flex flex-col justify-end">
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                                        <div className="relative z-10 backdrop-blur-md bg-stone-dark/60 p-6 md:p-8 border-t border-white/10 shadow-[0_-4px_30px_rgba(0,0,0,0.1)]">
                                            <div className="max-w-4xl">
                                                <h3 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
                                                    {event.title}
                                                </h3>
                                                <div className="flex items-center text-gray-300 text-base mb-2">
                                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    {formatEventDate(event, { long: true })}
                                                </div>
                                                <p className="text-gray-200 text-base line-clamp-2">
                                                    {stripHtml(event.description || '')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>

                    {/* Progress Bar Indicators - full width at very bottom */}
                    {featuredEvents.length > 1 && (
                        <div className="absolute bottom-0 left-0 right-0 z-30 flex gap-0">
                            {featuredEvents.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={(e) => { e.preventDefault(); setCarouselIndex(index); }}
                                    className="relative flex-1 h-1 bg-white/20 overflow-hidden cursor-pointer hover:bg-white/30 transition-colors"
                                    aria-label={`Go to slide ${index + 1}`}
                                >
                                    {/* Progress fill - animates when this slide is active */}
                                    <div
                                        key={`progress-${index}-${carouselIndex}`}
                                        className={`absolute inset-0 ${index === carouselIndex
                                            ? 'bg-emerald-500'
                                            : index < carouselIndex
                                                ? 'bg-white/60'
                                                : 'bg-transparent'
                                            }`}
                                        style={{
                                            width: index === carouselIndex ? '100%' : index < carouselIndex ? '100%' : '0%',
                                            animation: index === carouselIndex ? 'progressFill 5s linear forwards' : 'none',
                                        }}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Grid Items */}
                {gridItems.map((event) => (
                    <div key={event.id} className="relative group h-[300px] rounded-xl md:rounded-none overflow-hidden col-span-1 hover:scale-[1.02] transition-transform duration-300">
                        <Link href={`/events/${event.id}`} className="block w-full h-full relative z-10">
                            <img
                                src={event.image_url || '/images/event-placeholder.jpg'}
                                alt={event.title}
                                className="w-full h-full object-cover transition-transform duration-1000 ease-in-out group-hover:scale-110"
                            />
                            <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <BookmarkButton eventId={event.id} size="sm" className="bg-white/90 hover:bg-white shadow-sm" />
                            </div>
                            <TileOverlay
                                title={event.title}
                                category={event.category?.name}
                                categoryColor={event.category?.gradient_color}
                                date={formatEventDate(event)}
                                description={stripHtml(event.description || '')}
                                venue={event.venue_name}
                                checkins={event.checkin_count}
                            />
                        </Link>
                    </div>
                ))}
            </div>

            {/* View All Button */}
            {!hideFooter && (
                <div className="flex justify-center items-center py-12 bg-stone-dark">
                    <Link
                        href="/events"
                        className="inline-flex items-center px-8 py-3 border-2 border-white/20 rounded-lg text-white font-semibold hover:bg-white hover:text-stone-900 transition-all duration-300 uppercase tracking-wider"
                    >
                        View All Events
                    </Link>
                </div>
            )}
        </section>
    );
}
