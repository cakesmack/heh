import Link from 'next/link';
import DiscoveryBar from '@/components/home/DiscoveryBar';
import { useSearch } from '@/context/SearchContext';

interface HeroSectionProps {
    onSearch: (filters: {
        q?: string;
        location?: string;
        date?: string;
        dateFrom?: string;
        dateTo?: string;
        category?: string;
        latitude?: number;
        longitude?: number;
        radius?: string;
    }) => void;
    isSearchLoading?: boolean;
}

/**
 * Full-width hero with centered search bar.
 * Desktop: DiscoveryBar rendered inline via embedded mode.
 * Mobile: Ghost search trigger opens the existing fullscreen modal (SearchContext).
 */
export default function HeroSection({ onSearch, isSearchLoading = false }: HeroSectionProps) {
    const { openMobileSearch } = useSearch();

    return (
        <section className="relative min-h-[60vh] md:min-h-[60vh] flex items-center justify-center overflow-hidden bg-gray-950">
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/images/hero-bg.png')" }}
            />

            {/* Heavy dark overlay */}
            <div className="absolute inset-0 bg-black/70" />

            {/* Subtle top vignette for navbar bleed */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent" />

            {/* Content */}
            <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
                {/* Heading */}
                <div className="text-center mb-8 md:mb-12">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight drop-shadow-lg">
                        Discover the Highlands
                    </h1>
                    <p className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl mx-auto font-light leading-relaxed">
                        Find events, gigs, markets and festivals across the Scottish Highlands
                    </p>
                </div>

                {/* Search Bar — Desktop (DiscoveryBar embedded mode, hidden on mobile) */}
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                    <DiscoveryBar
                        onSearch={onSearch}
                        isLoading={isSearchLoading}
                        mode="embedded"
                    />
                </div>

                {/* Search Trigger — Mobile (opens fullscreen modal via SearchContext) */}
                <div className="md:hidden">
                    <button
                        onClick={openMobileSearch}
                        className="w-full flex items-center gap-3 px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white/60 text-left transition-all hover:bg-white/20 active:scale-[0.98]"
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="text-sm">Search events, venues, or towns...</span>
                    </button>
                </div>

                {/* B2B CTA Link */}
                <div className="text-center mt-6 md:mt-8">
                    <Link
                        href="/submit-event"
                        className="group text-white/50 hover:text-white/90 text-sm transition-colors duration-200"
                    >
                        Promoter or Venue?{' '}
                        <span className="underline underline-offset-4 decoration-white/30 group-hover:decoration-white/60 transition-all">
                            Add your event for free.
                        </span>
                    </Link>
                </div>
            </div>
        </section>
    );
}
