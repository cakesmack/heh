import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { HeroSlot, ActiveFeatured } from '@/types';
import { heroAPI, api } from '@/lib/api';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';

export default function HeroSection() {
    const [slots, setSlots] = useState<HeroSlot[]>([]);
    const [paidSlots, setPaidSlots] = useState<ActiveFeatured[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasPaidSlots, setHasPaidSlots] = useState(false);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                // Fetch both manual slots and paid slots in parallel
                const [manualData, paidData] = await Promise.all([
                    heroAPI.list(true),
                    api.featured.getActive('hero_home').catch(() => [])
                ]);

                // Find the welcome slot from manual slots
                const welcomeSlot = manualData.find((s: HeroSlot) => s.type === 'welcome');

                if (paidData && paidData.length > 0) {
                    // Option B: Welcome first + paid slots
                    setPaidSlots(paidData);
                    setHasPaidSlots(true);
                    // Keep welcome slot in manual slots for display
                    if (welcomeSlot) {
                        setSlots([welcomeSlot]);
                    }
                } else {
                    // No paid slots - use full manual hero slot system
                    const sortedData = [...manualData].sort((a: HeroSlot, b: HeroSlot) => {
                        if (a.type === 'welcome') return -1;
                        if (b.type === 'welcome') return 1;
                        return 0;
                    });
                    setSlots(sortedData);
                    setHasPaidSlots(false);
                }
            } catch (err) {
                console.error('Failed to load hero slots:', err);
                // Fall back to manual slots on error
                try {
                    const data = await heroAPI.list(true);
                    const sortedData = [...data].sort((a: HeroSlot, b: HeroSlot) => {
                        if (a.type === 'welcome') return -1;
                        if (b.type === 'welcome') return 1;
                        return 0;
                    });
                    setSlots(sortedData);
                } catch (e) {
                    console.error('Failed to load fallback hero slots:', e);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchSlots();
    }, []);

    // Calculate total display length:
    // - If hasPaidSlots: welcome (if exists) + paid slots
    // - Otherwise: just manual slots
    const displayLength = hasPaidSlots
        ? (slots.length + paidSlots.length)  // slots contains only welcome when hasPaidSlots
        : slots.length;

    const nextSlide = useCallback(() => {
        if (displayLength === 0) return;
        setCurrentIndex((prev) => (prev + 1) % displayLength);
    }, [displayLength]);

    const prevSlide = useCallback(() => {
        if (displayLength === 0) return;
        setCurrentIndex((prev) => (prev - 1 + displayLength) % displayLength);
    }, [displayLength]);

    useEffect(() => {
        if (displayLength <= 1 || isPaused) return;

        const timer = setInterval(nextSlide, 5000);
        return () => clearInterval(timer);
    }, [displayLength, isPaused, nextSlide]);

    if (loading) {
        return <div className="h-[80vh] min-h-[600px] bg-stone-dark animate-pulse" />;
    }

    if (displayLength === 0) {
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

    // Get current content based on whether we're showing paid or manual slots
    let title: string;
    let image: string;
    let ctaText: string;
    let ctaLink: string;
    let isWelcome = false;
    let isPaidFeatured = false;
    let subtitle: string | undefined;

    if (hasPaidSlots) {
        // Option B: Index 0 = welcome slot, Index 1+ = paid slots
        const welcomeCount = slots.length; // Usually 1 (the welcome slot)

        if (currentIndex < welcomeCount && slots[currentIndex]) {
            // Showing welcome slot
            const currentSlot = slots[currentIndex];
            isWelcome = currentSlot.type === 'welcome';
            title = currentSlot.title_override || 'Discover the Highlands';
            image = currentSlot.image_override || '/images/hero-bg.jpg';
            ctaText = currentSlot.cta_override || 'Find an Event';
            ctaLink = '/events';
        } else {
            // Showing paid slot (adjust index to account for welcome slot)
            const paidIndex = currentIndex - welcomeCount;
            const currentPaidSlot = paidSlots[paidIndex];
            title = currentPaidSlot.event_title;
            image = currentPaidSlot.event_image_url || '/images/hero-bg.jpg';
            ctaText = 'View Event Details';
            ctaLink = `/events/${currentPaidSlot.event_id}`;
            isPaidFeatured = true;
            subtitle = currentPaidSlot.custom_subtitle;  // Use custom subtitle if provided
        }
    } else {
        // Manual slots only (no paid slots)
        const currentSlot = slots[currentIndex];
        isWelcome = currentSlot?.type === 'welcome';
        const event = currentSlot?.event;

        title = isWelcome
            ? (currentSlot.title_override || 'Discover the Highlands')
            : (event?.title || 'Upcoming Event');

        image = isWelcome
            ? (currentSlot.image_override || '/images/hero-bg.jpg')
            : (event?.image_url || '/images/hero-bg.jpg');

        ctaText = isWelcome
            ? (currentSlot.cta_override || 'Find an Event')
            : 'View Event Details';

        ctaLink = isWelcome ? '/events' : (event ? `/events/${event.id}` : '/events');
    }

    return (
        <section
            className="relative h-[80vh] min-h-[600px] flex items-end pb-20 overflow-hidden bg-stone-dark group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Background Image */}
            {hasPaidSlots ? (
                // Option B: Render welcome slot(s) first, then paid slots
                <>
                    {/* Welcome slot background(s) */}
                    {slots.map((slot, index) => {
                        const slotImage = slot.type === 'welcome'
                            ? (slot.image_override || '/images/hero-bg.jpg')
                            : (slot.event?.image_url || '/images/hero-bg.jpg');
                        return (
                            <div
                                key={`welcome-${slot.id}`}
                                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                                style={{ backgroundImage: `url(${slotImage})` }}
                            />
                        );
                    })}
                    {/* Paid slot backgrounds */}
                    {paidSlots.map((slot, index) => {
                        const adjustedIndex = slots.length + index;
                        return (
                            <div
                                key={`paid-${slot.id}`}
                                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${adjustedIndex === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                                style={{ backgroundImage: `url(${slot.event_image_url || '/images/hero-bg.jpg'})` }}
                            />
                        );
                    })}
                </>
            ) : (
                slots.map((slot, index) => {
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
                })
            )}

            {/* Gradient Overlay */}
            <div className={`absolute inset-0 transition-colors duration-1000 ${(!hasPaidSlots && slots[currentIndex]?.overlay_style === 'light')
                ? 'bg-white/30'
                : 'bg-gradient-to-t from-stone-dark via-stone-dark/60 to-transparent'
                }`} />

            {/* Navigation Buttons */}
            {displayLength > 1 && (
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
                        {(isPaidFeatured || (!isWelcome && !hasPaidSlots)) && (
                            <Badge variant="warning" className="bg-yellow-500/90 text-white border-none backdrop-blur-sm shadow-lg">
                                Featured Event
                            </Badge>
                        )}
                        {!hasPaidSlots && slots[currentIndex]?.event?.category && !isWelcome && (
                            <Badge variant="default" className="bg-white/20 text-white border-none backdrop-blur-sm shadow-lg">
                                {slots[currentIndex].event!.category!.name}
                            </Badge>
                        )}
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight leading-tight drop-shadow-lg">
                        {isWelcome && title === 'Discover the Highlands' ? (
                            <>Discover the <span className="text-gradient">Highlands</span></>
                        ) : (
                            title
                        )}
                    </h1>

                    <p className="text-lg md:text-xl text-gray-100 mb-8 line-clamp-2 font-light drop-shadow-md max-w-2xl">
                        {isWelcome ? (
                            "Experience the best events, culture, and adventures in the heart of Scotland."
                        ) : isPaidFeatured ? (
                            subtitle || "Don't miss this featured event."
                        ) : (
                            <>
                                {slots[currentIndex]?.event?.date_start && (
                                    <span className="block font-medium mb-1">
                                        {new Date(slots[currentIndex].event!.date_start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                        {slots[currentIndex].event!.venue_name && ` • ${slots[currentIndex].event!.venue_name}`}
                                    </span>
                                )}
                                {slots[currentIndex]?.event?.description || "Join us for this amazing event."}
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

                {/* Progress Bar Indicators */}
                {displayLength > 1 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 z-20">
                        {Array.from({ length: displayLength }).map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className="relative h-1 w-8 sm:w-12 md:w-16 rounded-full bg-white/30 overflow-hidden cursor-pointer hover:bg-white/40 transition-colors"
                                aria-label={`Go to slide ${index + 1}`}
                            >
                                {/* Progress fill - animates when this slide is active */}
                                <div
                                    key={`progress-${index}-${currentIndex}`}
                                    className={`absolute inset-0 rounded-full ${index === currentIndex
                                            ? 'bg-emerald-500 animate-progress-fill'
                                            : index < currentIndex
                                                ? 'bg-white/80'
                                                : 'bg-transparent'
                                        }`}
                                    style={{
                                        width: index === currentIndex ? '100%' : index < currentIndex ? '100%' : '0%',
                                        animation: index === currentIndex && !isPaused ? 'progressFill 5s linear forwards' : 'none',
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
