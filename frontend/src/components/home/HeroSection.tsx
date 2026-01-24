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
            className="relative py-6 px-4 md:px-8 bg-stone-dark overflow-hidden group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Main Container: Rounded Triptych */}
            <div className="relative w-full max-w-[1600px] mx-auto h-[600px] md:h-[650px] rounded-3xl overflow-hidden flex flex-row gap-1 bg-stone-900 shadow-2xl">

                {/* Left Panel (25%) */}
                <div className="hidden md:block w-1/4 h-full relative transition-all duration-700">
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
                                <div className="absolute inset-0 bg-black/30 backdrop-brightness-75 transition-all duration-500 group-hover:backdrop-brightness-90" />
                            </div>
                        );
                    })}
                </div>

                {/* Center Panel (50% on desktop, 100% on mobile) */}
                <div className="w-full md:w-1/2 h-full relative">
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
                                {/* Text Readability Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />
                            </div>
                        );
                    })}

                    {/* Content Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 sm:p-12 z-20">
                        <div className="animate-slide-up max-w-xl">
                            <div className="flex items-center justify-center gap-3 mb-6">
                                {!isWelcome && (
                                    <Badge variant="warning" className="bg-amber-500 text-white border-none shadow-lg px-4 py-1 text-sm font-bold tracking-wider uppercase">
                                        Featured
                                    </Badge>
                                )}
                            </div>

                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight leading-tight drop-shadow-xl">
                                {isWelcome && title === 'Discover the Highlands' ? (
                                    <>Discover the <span className="text-emerald-400">Highlands</span></>
                                ) : (
                                    title
                                )}
                            </h1>

                            <div className="w-16 h-1 bg-emerald-500 mx-auto mb-6 rounded-full"></div>

                            <p className="text-lg md:text-xl text-gray-200 mb-8 line-clamp-3 font-medium drop-shadow-md max-w-md mx-auto leading-relaxed">
                                {subtitle}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link href={link}>
                                    <Button variant="primary" size="lg" className="shadow-xl bg-emerald-600 hover:bg-emerald-500 border-none text-white min-w-[180px] py-3.5 rounded-xl font-bold tracking-wide transition-all hover:scale-105">
                                        {ctaText}
                                    </Button>
                                </Link>
                                {isWelcome && (
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('categories');
                                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 backdrop-blur-md transition-all min-w-[180px]"
                                    >
                                        Browse Categories
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel (25%) */}
                <div className="hidden md:block w-1/4 h-full relative transition-all duration-700">
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
                                <div className="absolute inset-0 bg-black/30 backdrop-brightness-75 transition-all duration-500 group-hover:backdrop-brightness-90" />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Navigation Overlay (Absolute to Section) */}
            {slides.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full items-center justify-center text-white/70 hover:text-white transition-all z-30"
                        aria-label="Previous"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={nextSlide}
                        className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full items-center justify-center text-white/70 hover:text-white transition-all z-30"
                        aria-label="Next"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

            {/* Progress Bars */}
            {slides.length > 1 && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2 z-30">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex ? 'w-8 bg-emerald-500' : 'w-2 bg-white/30 hover:bg-white/50'}`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
