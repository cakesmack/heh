import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { HeroSlot, ActiveFeatured } from '@/types';
import { heroAPI, api } from '@/lib/api';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';

export default function HeroSection() {
    const [slides, setSlides] = useState<(HeroSlot | ActiveFeatured)[]>([]);
    const [welcomeSlot, setWelcomeSlot] = useState<HeroSlot | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSlides = async () => {
            try {
                // Parallel fetch: Welcome Slot (Static) + Paid Slots (Dynamic)
                const [manualData, paidData] = await Promise.all([
                    heroAPI.list(true), // active_only=true
                    api.featured.getActive('hero_home').catch(() => [])
                ]);

                // 1. Get Welcome Slide (admin managed)
                // We trust the manual endpoint to return the welcome slide (position 1)
                const welcome = manualData.find((s: HeroSlot) => s.position === 1 || s.type === 'welcome');
                setWelcomeSlot(welcome || null);

                // 2. Get Paid Bookings (max 4)
                // STRICT MODE: We only use data returned by getActive('hero_home')
                // This ensures no Magazine events leak here.
                const paidSlides = paidData.slice(0, 4);

                // 3. Merge: [Welcome, ...Paid]
                const mergedSlides: (HeroSlot | ActiveFeatured)[] = [];
                if (welcome) mergedSlides.push(welcome);
                mergedSlides.push(...paidSlides);

                setSlides(mergedSlides);
            } catch (err) {
                console.error('Failed to load hero slides:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSlides();
    }, []);

    const nextSlide = useCallback(() => {
        if (slides.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, [slides.length]);

    const prevSlide = useCallback(() => {
        if (slides.length === 0) return;
        setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }, [slides.length]);

    useEffect(() => {
        if (slides.length <= 1 || isPaused) return;
        const timer = setInterval(nextSlide, 5000);
        return () => clearInterval(timer);
    }, [slides.length, isPaused, nextSlide]);

    // Helper to check type
    const isWelcomeSlide = (slide: HeroSlot | ActiveFeatured): slide is HeroSlot => {
        return (slide as HeroSlot).type === 'welcome' || (slide as HeroSlot).position === 1;
    };

    if (loading) {
        return <div className="h-[80vh] min-h-[600px] bg-stone-dark animate-pulse" />;
    }

    if (slides.length === 0) {
        // Fallback default view
        return (
            <section className="relative h-[70vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-stone-dark">
                <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-50" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-dark via-stone-dark/40 to-transparent" />
                <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                        Discover the <span className="text-gradient">Highlands</span>
                    </h1>
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

    const currentSlide = slides[currentIndex];
    const isWelcome = isWelcomeSlide(currentSlide);

    // Extract display data based on type
    const title = isWelcome
        ? (currentSlide.title_override || 'Discover the Highlands')
        : (currentSlide as ActiveFeatured).event_title;

    const subtitle = isWelcome
        ? "Experience the best events, culture, and adventures in the heart of Scotland."
        : (currentSlide as ActiveFeatured).custom_subtitle || "Featured Event";

    const link = isWelcome
        ? '/events'
        : `/events/${(currentSlide as ActiveFeatured).event_id}`;

    const ctaText = isWelcome
        ? (currentSlide.cta_override || 'Find an Event')
        : 'View Event Details';

    return (
        <section
            className="relative h-[80vh] min-h-[600px] flex items-end pb-20 overflow-hidden bg-stone-dark group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Background Images with Crossfade */}
            {slides.map((slide, index) => {
                const img = isWelcomeSlide(slide)
                    ? (slide.image_override || '/images/hero-bg.jpg')
                    : (slide.event_image_url || '/images/hero-bg.jpg');

                return (
                    <div
                        key={isWelcomeSlide(slide) ? `welcome-${slide.id}` : `paid-${slide.id}`}
                        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                        style={{ backgroundImage: `url(${img})` }}
                    />
                );
            })}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-dark via-stone-dark/60 to-transparent" />

            {/* Navigation Buttons */}
            {slides.length > 1 && (
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
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight leading-tight drop-shadow-lg">
                        {isWelcome && title === 'Discover the Highlands' ? (
                            <>Discover the <span className="text-gradient">Highlands</span></>
                        ) : (
                            title
                        )}
                    </h1>

                    <p className="text-lg md:text-xl text-gray-100 mb-8 line-clamp-2 font-light drop-shadow-md max-w-2xl">
                        {subtitle}
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <Link href={link}>
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
            </div>

            {/* Progress Bar Indicators */}
            {slides.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 z-30">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className="relative h-1 w-8 sm:w-12 md:w-16 rounded-full bg-white/30 overflow-hidden cursor-pointer hover:bg-white/40 transition-colors"
                            aria-label={`Go to slide ${index + 1}`}
                        >
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
        </section>
    );
}
