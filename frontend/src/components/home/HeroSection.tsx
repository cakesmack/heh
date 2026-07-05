import Link from 'next/link';
import Image from 'next/image';
import DiscoveryBar from '@/components/home/DiscoveryBar';

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

export default function HeroSection({ onSearch, isSearchLoading = false }: HeroSectionProps) {

    return (
        <section className="relative min-h-[60vh] md:min-h-[60vh] flex items-center justify-center overflow-hidden bg-gray-950">
            {/* Background Image */}
            <Image
                src="/images/hero-bg.jpg"
                alt="Highlands Background"
                fill
                priority
                className="object-cover object-center"
                sizes="100vw"
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

                {/* Hero Search Bar */}
                <div className="w-full max-w-3xl mx-auto relative z-20 mt-6">
                    <DiscoveryBar
                        onSearch={onSearch}
                        isLoading={isSearchLoading}
                        mode="embedded"
                    />
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
