import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { HeroSlot, ActiveFeatured } from '@/types';
import { heroAPI, api } from '@/lib/api';
import { getOptimizedImage } from '@/lib/images';
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
            {/* Depth Stack Grid Layout */}
            {/* gap-0: Removed gap to allow negative margins to pull columns together seamlessly */}
            <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-[0.8fr_1.4fr_0.8fr] h-full gap-0 p-4 md:p-6 bg-stone-dark items-center justify-items-center">

                {/* Left Column (Desktop Only) */}
                {/* h-[85%]: Smaller height for staggered look */}
                {/* Left Column (Desktop Only) - Depth Stack Side */}
                <div className="hidden md:block relative h-[90%] -mr-12 lg:-mr-24 z-10 brightness-50 hover:brightness-100 blur-[1px] hover:blur-0 transition-all duration-500 ease-out rounded-2xl overflow-hidden shadow-lg group/side transform hover:scale-105 hover:z-30">
                    {slides.map((slide, index) => {
                        const rawImg = isWelcomeSlide(slide)
                            ? ((slide as HeroSlot).image_override_left || (slide as HeroSlot).image_override || '/images/hero-bg.jpg')
                            : ((slide as ActiveFeatured).event_image_url || '/images/hero-bg.jpg');
                        const img = getOptimizedImage(rawImg, 800);

                        return (
                            <div
                                key={`left-${index}`}
                                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                                style={{ backgroundImage: `url(${img})` }}
                            >
                                <div className="absolute inset-0 bg-black/40" />
                            </div>
                        );
                    })}
                </div>

                {/* Center Column (Main - The Hero) */}
                {/* Center Column (Main - The Hero) - Depth Stack Top */}
                <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl z-20 transform transition-transform duration-700 border border-white/5 ring-1 ring-white/10">
                    {slides.map((slide, index) => {
                        const rawImg = isWelcomeSlide(slide)
                            ? ((slide as HeroSlot).image_override || '/images/hero-bg.jpg')
                            : ((slide as ActiveFeatured).event_image_url || '/images/hero-bg.jpg');
                        const img = getOptimizedImage(rawImg, 1280);

                        return (
                            <div
                                key={`main-${index}`}
                                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                                style={{ backgroundImage: `url(${img})` }}
                            >
                                {/* Text Readability Gradient: Strong at bottom to support text */}
                                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                            </div>
                        );
                    })}

                    {/* Content Overlay */}
                    <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-center text-center p-6 sm:p-12 z-20">
                        <div className="animate-slide-up max-w-2xl mt-auto pb-12 sm:pb-20 md:mt-0 md:pb-0">
                            <div className="flex items-center justify-center gap-3 mb-6">
                                {!isWelcome && (
                                    <Badge variant="warning" className="bg-yellow-500/90 text-white border-none backdrop-blur-sm shadow-xl px-4 py-1.5 text-sm font-bold tracking-wide">
                                        FEATURED EVENT
                                    </Badge>
                                )}
                            </div>

                            <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-white mb-6 tracking-tight leading-[1.1] drop-shadow-2xl">
                                {isWelcome && title === 'Discover the Highlands' ? (
                                    <>Discover the <span className="text-emerald-400 drop-shadow-lg">Highlands</span></>
                                ) : (
                                    title
                                )}
                            </h1>

                            <div className="w-24 h-1.5 bg-emerald-500 mx-auto mb-8 rounded-full shadow-lg"></div>

                            <p className="text-lg md:text-xl text-gray-100 mb-10 line-clamp-3 font-medium drop-shadow-lg max-w-lg mx-auto leading-relaxed text-shadow-sm">
                                {subtitle}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link href={link}>
                                    <Button variant="primary" size="lg" className="shadow-2xl shadow-emerald-900/40 border-none bg-emerald-600 hover:bg-emerald-500 text-white min-w-[200px] text-lg py-4 rounded-xl transition-transform hover:-translate-y-1">
                                        {ctaText}
                                    </Button>
                                </Link>
                                {isWelcome && (
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('categories');
                                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="px-8 py-4 rounded-xl border-2 border-white/30 bg-white/5 text-white font-bold hover:bg-white/10 hover:border-white/50 transition-all backdrop-blur-md min-w-[200px] shadow-lg hover:-translate-y-1"
                                    >
                                        Browse Categories
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column (Desktop Only) */}
                {/* h-[85%]: Smaller height for staggered look */}
                {/* Right Column (Desktop Only) - Depth Stack Side */}
                <div className="hidden md:block relative h-[90%] -ml-12 lg:-ml-24 z-10 brightness-50 hover:brightness-100 blur-[1px] hover:blur-0 transition-all duration-500 ease-out rounded-2xl overflow-hidden shadow-lg group/side transform hover:scale-105 hover:z-30">
                    {slides.map((slide, index) => {
                        const rawImg = isWelcomeSlide(slide)
                            ? ((slide as HeroSlot).image_override_right || (slide as HeroSlot).image_override || '/images/hero-bg.jpg')
                            : ((slide as ActiveFeatured).event_image_url || '/images/hero-bg.jpg');
                        const img = getOptimizedImage(rawImg, 800);

                        return (
                            <div
                                key={`right-${index}`}
                                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                                style={{ backgroundImage: `url(${img})` }}
                            >
                                <div className="absolute inset-0 bg-black/40" />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Navigation Buttons (Desktop Only - positioned over side columns) */}
            {slides.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="hidden md:flex absolute left-0 inset-y-0 w-[15%] bg-black/0 hover:bg-black/20 transition-colors z-30 items-center justify-center text-white/50 hover:text-white"
                        aria-label="Previous slide"
                    >
                        <svg className="w-12 h-12 drop-shadow-lg transform -translate-x-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={nextSlide}
                        className="hidden md:flex absolute right-0 inset-y-0 w-[15%] bg-black/0 hover:bg-black/20 transition-colors z-30 items-center justify-center text-white/50 hover:text-white"
                        aria-label="Next slide"
                    >
                        <svg className="w-12 h-12 drop-shadow-lg transform translate-x-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

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
