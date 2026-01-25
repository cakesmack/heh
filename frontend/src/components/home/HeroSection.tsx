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
            className="w-full bg-stone-dark overflow-hidden py-4 px-4 sm:px-6 lg:px-8"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-2 h-auto lg:h-[600px]">

                {/* 1. The Big Left Card (The Hero) */}
                <div className="lg:col-span-2 relative h-[500px] lg:h-full overflow-hidden rounded-3xl group cursor-pointer">
                    {/* Background Image with Zoom Effect */}
                    {slides.length > 0 && (slides.map((slide, index) => {
                        // Only render current slide to save resources or render all for transitions?
                        // "Bento" usually implies static cards, but here we still have a slideshow.
                        // Let's keep the slideshow logic for the MAIN card.
                        const rawImg = isWelcomeSlide(slide)
                            ? ((slide as HeroSlot).image_override_left || (slide as HeroSlot).image_override || '/images/hero-bg.jpg')
                            : ((slide as ActiveFeatured).event_image_url || '/images/hero-bg.jpg');
                        const img = getOptimizedImage(rawImg, 1280);

                        return (
                            <div
                                key={`hero-bg-${index}`}
                                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                            >
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                    style={{ backgroundImage: `url(${img})` }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
                            </div>
                        );
                    }))}

                    {/* Content Layer */}
                    <div className="absolute bottom-0 left-0 p-8 lg:p-12 w-full z-20 flex flex-col items-start text-left">
                        <div className="animate-slide-up max-w-2xl">
                            {!isWelcome && (
                                <Badge variant="warning" className="mb-4 bg-amber-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold tracking-wider uppercase inline-block">
                                    Featured Event
                                </Badge>
                            )}

                            <h1 className="text-4xl lg:text-6xl font-bold text-white mb-4 leading-tight tracking-tight drop-shadow-xl">
                                {isWelcome && title === 'Discover the Highlands' ? (
                                    <>Highland <span className="text-emerald-400">Events Hub</span></>
                                ) : (
                                    title
                                )}
                            </h1>

                            <p className="text-gray-200 text-lg lg:text-xl mb-8 max-w-lg font-medium drop-shadow-md leading-relaxed line-clamp-3">
                                {subtitle}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                <Link href={link} className="w-full sm:w-auto">
                                    <Button variant="primary" size="lg" className="w-full sm:w-auto shadow-xl shadow-emerald-900/40 border-none bg-emerald-600 hover:bg-emerald-500 text-white min-w-[160px] py-3.5 rounded-xl font-semibold transition-transform hover:-translate-y-0.5">
                                        {ctaText}
                                    </Button>
                                </Link>
                                {isWelcome && (
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('categories');
                                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-white/30 bg-white/10 text-white font-semibold hover:bg-white/20 hover:border-white/50 transition-all backdrop-blur-md min-w-[160px] shadow-lg hover:-translate-y-0.5"
                                    >
                                        Browse Categories
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. The Right Stack (The Vibe) */}
                <div className="hidden lg:flex flex-col gap-2 h-full">
                    {/* Top Right Card */}
                    <div className="relative h-1/2 w-full overflow-hidden rounded-3xl group">
                        {/* We use slide[1] or fallback to Welcome Left Image if not enough slides */}
                        {(() => {
                            // If we have a slide at index 1 (likely "featured"), show it.
                            // Otherwise show a nice fallback or mapped slide.
                            // Ideally, we'd cycle these too, or just show the next ones in queue.
                            // Let's try to show slides[(currentIndex + 1) % len] and slides[(currentIndex + 2) % len] to keep it dynamic?
                            // Or just static placeholders if user wants "Live Music" / "Local Culture"?
                            // The user prompt asked for "The Right Stack... Cards (Top & Bottom)... Images... Same group-hover effect".

                            // Let's use the next slide in the rotation for variety, or distinct slides if available.
                            // Given fetching logic `slides` typically has 1 welcome + up to 4 paid.

                            const nextIndex1 = (currentIndex + 1) % (slides.length || 1);
                            const slide1 = slides[nextIndex1];

                            const rawImg1 = slide1
                                ? (isWelcomeSlide(slide1) ? ((slide1 as HeroSlot).image_override || '/images/hero-bg.jpg') : ((slide1 as ActiveFeatured).event_image_url || '/images/hero-bg.jpg'))
                                : '/images/hero-bg.jpg';
                            const img1 = getOptimizedImage(rawImg1, 800);

                            return (
                                <>
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                        style={{ backgroundImage: `url(${img1})` }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity group-hover:opacity-90" />
                                    <div className="absolute bottom-4 left-4">
                                        <span className="text-white font-medium text-xs sm:text-sm bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                            Live Events
                                        </span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Bottom Right Card */}
                    <div className="relative h-1/2 w-full overflow-hidden rounded-3xl group">
                        {(() => {
                            const nextIndex2 = (currentIndex + 2) % (slides.length || 1);
                            // Avoid duplicate if len=2? default handles it
                            const slide2 = slides[nextIndex2];

                            const rawImg2 = slide2
                                ? (isWelcomeSlide(slide2) ? ((slide2 as HeroSlot).image_override_right || (slide2 as HeroSlot).image_override || '/images/hero-bg.jpg') : ((slide2 as ActiveFeatured).event_image_url || '/images/hero-bg.jpg'))
                                : '/images/hero-bg.jpg';
                            const img2 = getOptimizedImage(rawImg2, 800);

                            return (
                                <>
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                        style={{ backgroundImage: `url(${img2})` }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity group-hover:opacity-90" />
                                    <div className="absolute bottom-4 left-4">
                                        <span className="text-white font-medium text-xs sm:text-sm bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                            Local Culture
                                        </span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Mobile Stack: Show a simplified version of right stack below? 
                    User prompt: "Right side is stacked (1 col)." 
                    "Buttons: Stacked on mobile (w-full)..."
                    Currently I hid the right column on mobile (`hidden lg:flex`).
                    If we want it visible, we can make it display below.
                    However, usually Bento grids collapse to just the main hero on mobile to save vertical space, 
                    or show the secondary tiles as squares below.
                    The previous Hero implementation didn't show the right column on mobile either (hidden md:flex).
                    I'll keep `hidden lg:flex` for now to focus on the main content unless user asks otherwise.
                */}
            </div>

            {/* Progress Indicators - Positioned bottom-left relative to Main Card? 
                Actually, simpler to hide them in Bento or put them floating in the main card.
                Let's put them inside the main card, bottom right or bottom center.
            */}
            {slides.length > 1 && (
                <div className="absolute bottom-8 lg:bottom-12 left-1/2 lg:left-auto lg:right-12 -translate-x-1/2 lg:translate-x-0 flex gap-1.5 z-30">
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
