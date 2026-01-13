import React, { useState, useRef, useEffect } from 'react';

const features = [
    {
        icon: (
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
        ),
        title: "The One Source",
        subtitle: "Uncover the Highlands.",
        description: "You shouldn't need to check five venue websites, three Facebook groups, and the local paper just to plan your weekend. We bring the entire Highlands onto one map so you can discover the hidden gems, village hall gigs, and local festivals you'd otherwise miss."
    },
    {
        icon: (
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        title: "Real Events Only",
        subtitle: "Zero Spam.",
        description: "Global ticket sites are full of junk. We filter out the \"get rich quick\" webinars and generic online courses to give you a clean feed of live music, culture, and adventure. If it's listed here, it's happening here—in person."
    },
    {
        icon: (
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
        ),
        title: "Built for Locals",
        subtitle: "Curated, Not Cluttered.",
        description: "We aren't a generic algorithm scraping the whole world. We focus strictly on the Highlands, monitoring hundreds of local sources to find the events that don't always make it to the big ticket sites."
    }
];

const FeatureCard = ({ icon, title, subtitle, description }: typeof features[0]) => (
    <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm h-full w-full">
        <div className="bg-emerald-50 p-4 rounded-2xl mb-6">
            {icon}
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">{title}</h3>
        <p className="text-emerald-700 font-medium mb-4">{subtitle}</p>
        <p className="text-gray-600 leading-relaxed text-sm md:text-base whitespace-normal">
            {description}
        </p>
    </div>
);

const Features = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Track scroll position to update pagination dots
    useEffect(() => {
        const scrollContainer = scrollRef.current;
        if (!scrollContainer) return;

        const handleScroll = () => {
            const scrollLeft = scrollContainer.scrollLeft;
            const cardWidth = scrollContainer.offsetWidth * 0.85 + 16; // 85vw + gap
            const newIndex = Math.round(scrollLeft / cardWidth);
            setActiveIndex(Math.min(newIndex, features.length - 1));
        };

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <section className="bg-gray-50 py-12 md:py-20 lg:py-32 border-b border-gray-100">
            <div className="max-w-7xl mx-auto">
                {/* Desktop: Grid Layout */}
                <div className="hidden md:grid md:grid-cols-3 gap-12 lg:gap-16 px-4 sm:px-6 lg:px-8">
                    {features.map((feature, idx) => (
                        <FeatureCard key={idx} {...feature} />
                    ))}
                </div>

                {/* Mobile: Horizontal Swipe Carousel */}
                <div className="md:hidden">
                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 px-4 pb-4"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {features.map((feature, idx) => (
                            <div
                                key={idx}
                                className="w-[85vw] snap-center flex-shrink-0"
                            >
                                <FeatureCard {...feature} />
                            </div>
                        ))}
                    </div>

                    {/* Pagination Dots */}
                    <div className="flex justify-center gap-2 mt-4">
                        {features.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    const scrollContainer = scrollRef.current;
                                    if (scrollContainer) {
                                        const cardWidth = scrollContainer.offsetWidth * 0.85 + 16;
                                        scrollContainer.scrollTo({
                                            left: cardWidth * idx,
                                            behavior: 'smooth'
                                        });
                                    }
                                }}
                                className={`w-2 h-2 rounded-full transition-colors ${idx === activeIndex
                                    ? 'bg-emerald-600'
                                    : 'bg-gray-300 hover:bg-gray-400'
                                    }`}
                                aria-label={`Go to slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Features;
