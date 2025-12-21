import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { HeroSlot } from '@/types';
import { heroAPI } from '@/lib/api';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';

export default function HeroSection() {
    const [slots, setSlots] = useState<HeroSlot[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                const data = await heroAPI.list(true); // Get active slots only
                // Ensure 'welcome' slot is always first
                const sortedData = [...data].sort((a, b) => {
                    if (a.type === 'welcome') return -1;
                    if (b.type === 'welcome') return 1;
                    return 0;
                });
                setSlots(sortedData);
            } catch (err) {
                console.error('Failed to load hero slots:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSlots();
    }, []);

    const nextSlide = useCallback(() => {
        if (slots.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % slots.length);
    }, [slots.length]);

    const prevSlide = useCallback(() => {
        if (slots.length === 0) return;
        setCurrentIndex((prev) => (prev - 1 + slots.length) % slots.length);
    }, [slots.length]);

    useEffect(() => {
        if (slots.length <= 1 || isPaused) return;

        const timer = setInterval(nextSlide, 5000);
        return () => clearInterval(timer);
    }, [slots.length, isPaused, nextSlide]);

    if (loading) {
        return <div className="h-[80vh] min-h-[600px] bg-stone-dark animate-pulse" />;
    }

    if (slots.length === 0) {
        // Fallback if no slots are configured
        return (
            <section className="relative h-[70vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-stone-dark">
                <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-50" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-dark via-stone-dark/40 to-transparent" />

                <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                        Discover the <span className="text-gradient">Highlands</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl mx-auto font-light">
                        Experience the best events, culture, and adventures in the heart of Scotland.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/events">
                            <Button variant="white" size="lg" className="shadow-lg shadow-white/10">
                                Find an Event
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    const currentSlot = slots[currentIndex];
    const isWelcome = currentSlot.type === 'welcome';
    const event = currentSlot.event;

    // Determine content
    const title = isWelcome
        ? (currentSlot.title_override || 'Discover the Highlands')
        : (event?.title || 'Upcoming Event');

    const image = isWelcome
        ? (currentSlot.image_override || '/images/hero-bg.jpg')
        : (event?.image_url || '/images/hero-bg.jpg');

    const ctaText = isWelcome
        ? (currentSlot.cta_override || 'Find an Event')
        : 'View Event Details';

    const ctaLink = isWelcome ? '/events' : (event ? `/events/${event.id}` : '/events');

    return (
        <section
            className="relative h-[80vh] min-h-[600px] flex items-end pb-20 overflow-hidden bg-stone-dark group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Background Image */}
            {slots.map((slot, index) => {
                const slotImage = slot.type === 'welcome'
                    ? (slot.image_override || '/images/hero-bg.jpg')
                    : (slot.event?.image_url || '/images/hero-bg.jpg');

                return (
                    <div
                        key={slot.id}
                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'
                            }`}
                        style={{ backgroundImage: `url(${slotImage})` }}
                    />
                );
            })}

            {/* Gradient Overlay */}
            <div className={`absolute inset-0 transition-colors duration-1000 ${currentSlot.overlay_style === 'light'
                ? 'bg-white/30'
                : 'bg-gradient-to-t from-stone-dark via-stone-dark/60 to-transparent'
                }`} />

            {/* Navigation Buttons */}
            {slots.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-0 inset-y-0 w-24 bg-gradient-to-r from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center text-white/70 hover:text-white z-20"
                        aria-label="Previous slide"
                    >
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute right-0 inset-y-0 w-24 bg-gradient-to-l from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center text-white/70 hover:text-white z-20"
                        aria-label="Next slide"
                    >
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

            {/* Content */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl animate-slide-up">
                    <div className="flex items-center gap-3 mb-4">
                        {!isWelcome && (
                            <Badge variant="warning" className="bg-yellow-500/90 text-white border-none backdrop-blur-sm shadow-lg">
                                Featured Event
                            </Badge>
                        )}
                        {event?.category && !isWelcome && (
                            <Badge variant="default" className="bg-white/20 text-white border-none backdrop-blur-sm shadow-lg">
                                {event.category.name}
                            </Badge>
                        )}
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight leading-tight drop-shadow-lg">
                        {isWelcome ? (
                            title === 'Discover the Highlands' ? (
                                <>Discover the <span className="text-gradient">Highlands</span></>
                            ) : title
                        ) : (
                            title
                        )}
                    </h1>

                    <p className="text-lg md:text-xl text-gray-100 mb-8 line-clamp-2 font-light drop-shadow-md max-w-2xl">
                        {isWelcome ? (
                            "Experience the best events, culture, and adventures in the heart of Scotland."
                        ) : (
                            <>
                                {event?.date_start && (
                                    <span className="block font-medium mb-1">
                                        {new Date(event.date_start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                        {event.venue_name && ` • ${event.venue_name}`}
                                    </span>
                                )}
                                {event?.description || "Join us for this amazing event."}
                            </>
                        )}
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <Link href={ctaLink}>
                            <Button variant="white" size="lg" className="shadow-lg shadow-white/10 border-none">
                                {ctaText}
                            </Button>
                        </Link>
                        {isWelcome && (
                            <button
                                onClick={() => {
                                    const el = document.getElementById('categories');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-6 py-3 rounded-xl border border-white/30 bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm"
                            >
                                Browse Categories
                            </button>
                        )}
                    </div>
                </div>

                {/* Indicators */}
                {slots.length > 1 && (
                    <div className="absolute bottom-8 right-4 sm:right-8 flex gap-2 z-20">
                        {slots.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex ? 'w-8 bg-white' : 'w-4 bg-white/40 hover:bg-white/60'
                                    }`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
