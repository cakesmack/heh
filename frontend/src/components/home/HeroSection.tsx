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
            className="w-full bg-black overflow-hidden"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Main Grid: Full Width, Tiny Gap for Cinema Effect */}
            <div className="w-full h-[600px] lg:h-[700px] grid grid-cols-1 lg:grid-cols-3 gap-1 bg-black">

                {/* 1. The Big Left Panel (The Hero) */}
                <div className="lg:col-span-2 relative h-[500px] lg:h-full w-full overflow-hidden group cursor-pointer">
                    {/* Background Image with Zoom Effect */}
                    {slides.length > 0 && (slides.map((slide, index) => {
                        const rawImg = isWelcomeSlide(slide)
                            ? ((slide as HeroSlot).image_override_left || (slide as HeroSlot).image_override || '/images/hero-bg.jpg')
                            : ((slide as ActiveFeatured).event_image_url || '/images/hero-bg.jpg');
                        const img = getOptimizedImage(rawImg, 1600); // Higher res for full width

                        return (
                            <div
                                key={`hero-bg-${index}`}
                                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                            >
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out group-hover:scale-105"
                                    style={{ backgroundImage: `url(${img})` }}
                                />
                                {/* Gradient: Heavy bottom for text readability */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10" />
                            </div>
                        );
                    }))}

                    {/* Content Layer */}
                    <div className="absolute bottom-0 left-0 p-8 lg:p-16 w-full z-20 flex flex-col items-start text-left">
                        <div className="animate-slide-up w-full max-w-4xl">
                            {!isWelcome && (
                                <Badge variant="warning" className="mb-6 bg-amber-500 text-white border-none shadow-lg px-4 py-1.5 text-sm font-bold tracking-widest uppercase inline-block">
                                    Featured Event
                                </Badge>
                            )}

                            <h1 className="text-5xl lg:text-8xl font-black text-white mb-6 uppercase tracking-tighter leading-none drop-shadow-2xl">
                                {isWelcome && title === 'Discover the Highlands' ? (
                                    <>Highland <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Events Hub</span></>
                                ) : (
                                    title
                                )}
                            </h1>

                            <p className="text-gray-200 text-lg lg:text-2xl mb-10 max-w-2xl font-medium drop-shadow-md leading-relaxed line-clamp-3">
                                {subtitle}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                                <Link href={link} className="w-full sm:w-auto">
                                    <Button variant="primary" size="lg" className="w-full sm:w-auto shadow-2xl shadow-emerald-900/40 border-none bg-emerald-600 hover:bg-emerald-500 text-white min-w-[200px] py-4 rounded-none uppercase tracking-widest font-bold text-lg transition-all hover:scale-105">
                                        {ctaText}
                                    </Button>
                                </Link>
                                {isWelcome && (
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('categories');
                                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="w-full sm:w-auto px-8 py-4 rounded-none border-2 border-white bg-transparent text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all backdrop-blur-sm min-w-[200px] shadow-lg hover:scale-105"
                                    >
                                        Browse Categories
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. The Right Stack (The Vibe) */}
                <div className="hidden lg:flex flex-col h-full gap-1 w-full">

                    {/* Top Right Card */}
                    <div className="relative h-1/2 w-full overflow-hidden group cursor-pointer">
                        {/* Next Slide or Placeholder */}
                        {(() => {
                            const nextIndex1 = (currentIndex + 1) % (slides.length || 1);
                            const slide1 = slides[nextIndex1];

                            const rawImg1 = slide1
                                ? (isWelcomeSlide(slide1) ? ((slide1 as HeroSlot).image_override || '/images/hero-bg.jpg') : ((slide1 as ActiveFeatured).event_image_url || '/images/hero-bg.jpg'))
                                : '/images/hero-bg.jpg';
                            const img1 = getOptimizedImage(rawImg1, 800);

                            return (
                                <>
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                        style={{ backgroundImage: `url(${img1})` }}
                                    />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-500" />

                                    {/* Centered Label Override */}
                                    <div className="absolute inset-0 flex items-center justify-center z-20">
                                        <span className="text-white text-2xl font-bold uppercase tracking-widest border-2 border-white px-8 py-3 transition-transform duration-500 group-hover:scale-110 backdrop-blur-sm bg-black/10">
                                            Live Music
                                        </span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Bottom Right Card */}
                    <div className="relative h-1/2 w-full overflow-hidden group cursor-pointer">
                        {(() => {
                            const nextIndex2 = (currentIndex + 2) % (slides.length || 1);
                            const slide2 = slides[nextIndex2];

                            const rawImg2 = slide2
                                ? (isWelcomeSlide(slide2) ? ((slide2 as HeroSlot).image_override_right || (slide2 as HeroSlot).image_override || '/images/hero-bg.jpg') : ((slide2 as ActiveFeatured).event_image_url || '/images/hero-bg.jpg'))
                                : '/images/hero-bg.jpg';
                            const img2 = getOptimizedImage(rawImg2, 800);

                            return (
                                <>
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                        style={{ backgroundImage: `url(${img2})` }}
                                    />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-500" />

                                    {/* Centered Label Override */}
                                    <div className="absolute inset-0 flex items-center justify-center z-20">
                                        <span className="text-white text-2xl font-bold uppercase tracking-widest border-2 border-white px-8 py-3 transition-transform duration-500 group-hover:scale-110 backdrop-blur-sm bg-black/10">
                                            Local Culture
                                        </span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Progress Indicators - Minimalist, Bottom Left */}
            {slides.length > 1 && (
                <div className="absolute bottom-8 lg:bottom-16 left-8 lg:left-16 flex gap-3 z-30">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${index === currentIndex ? 'w-6 bg-emerald-400' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
