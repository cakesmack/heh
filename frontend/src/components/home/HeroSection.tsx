import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HeroSlot } from '@/types';
import { heroAPI } from '@/lib/api';
import { getOptimizedImage } from '@/lib/images';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';

/**
 * Magazine Fixed 4-Slot Hero
 * Layout: 2 Columns
 * - Left: Main Hero (Slot 0) - Takes 2/3 width on desktop.
 * - Right: Vertical Stack (Slots 1, 2, 3) - Takes 1/3 width, equal height cards.
 */
export default function HeroSection() {
    const [slots, setSlots] = useState<HeroSlot[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                const data = await heroAPI.list();
                const sorted = data.sort((a, b) => a.position - b.position);
                setSlots(sorted);
            } catch (err) {
                console.error('Failed to load hero slots:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSlots();
    }, []);

    const mainSlot = slots.find(s => s.position === 0);
    const sideSlots = slots.filter(s => s.position > 0 && s.position < 4);

    if (loading) {
        return <div className="h-[90vh] min-h-[600px] bg-black animate-pulse" />;
    }

    if (!mainSlot) {
        // Fallback if migration hasn't run or data is missing
        return null;
    }

    return (
        <section className="w-full bg-black overflow-hidden relative">
            {/* Desktop: Magazine Grid (h-[800px] or fit) */}
            <div className="hidden lg:grid grid-cols-3 gap-1 h-[800px]">

                {/* 1. MAIN HERO (Left Column - Span 2) */}
                <div className="col-span-2 relative group overflow-hidden">
                    <HeroCard slot={mainSlot} isMain={true} />
                </div>

                {/* 2. SIDE STACK (Right Column - Span 1) */}
                <div className="col-span-1 flex flex-col gap-1 h-full">
                    {sideSlots.map((slot) => (
                        // Using flex-1 to distribute height equally (33% each)
                        <div key={slot.id} className="relative flex-1 group overflow-hidden">
                            <HeroCard slot={slot} isMain={false} />
                        </div>
                    ))}
                    {/* Fallback for missing side slots */}
                    {[...Array(3 - sideSlots.length)].map((_, i) => (
                        <div key={`empty-${i}`} className="relative flex-1 bg-neutral-900" />
                    ))}
                </div>
            </div>

            {/* Mobile: Vertical Stack (Main Top + cards below) */}
            <div className="lg:hidden flex flex-col">
                {/* Main Hero (Taller) */}
                <div className="relative h-[70vh] w-full">
                    <HeroCard slot={mainSlot} isMain={true} />
                </div>

                {/* Side Stack (As nav cards below) */}
                <div className="grid grid-cols-1 gap-1 mt-1">
                    {sideSlots.map((slot) => (
                        <div key={slot.id} className="relative h-48 w-full">
                            <HeroCard slot={slot} isMain={false} mobileCompact={true} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// --- Reusable Sub-Component for Rendering a Slot ---
function HeroCard({ slot, isMain, mobileCompact }: { slot: HeroSlot, isMain: boolean, mobileCompact?: boolean }) {
    const img = getOptimizedImage(slot.image_override || '/images/hero-bg.jpg', isMain ? 1600 : 800);

    // Resolve badge color
    const badgeColorMap: Record<string, string> = {
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        blue: 'bg-blue-600',
        rose: 'bg-rose-600',
        purple: 'bg-purple-600',
        gray: 'bg-gray-600',
    };
    const badgeClass = badgeColorMap[slot.badge_color || 'emerald'] || badgeColorMap.emerald;

    // Content Block
    const Content = () => (
        <>
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                style={{ backgroundImage: `url(${img})` }}
            />
            {/* Gradient Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t ${isMain ? 'from-black/90 via-black/20' : 'from-black/80 via-black/10'} to-transparent z-10 transition-opacity group-hover:opacity-90`} />

            {/* Badge (Top Left) */}
            {slot.badge_text && (
                <div className={`absolute top-6 left-6 z-20 ${badgeClass} text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg`}>
                    {slot.badge_text}
                </div>
            )}

            {/* Text Content (Bottom Left) */}
            <div className={`absolute bottom-0 left-0 w-full z-20 flex flex-col items-start ${isMain ? 'p-12' : 'p-8'}`}>
                <h3 className={`font-bold text-white leading-tight drop-shadow-lg ${isMain ? 'text-4xl lg:text-7xl mb-6 uppercase tracking-tight' : 'text-2xl lg:text-3xl mb-2'}`}>
                    {slot.title_override || 'Untitled'}
                </h3>

                {isMain && slot.cta_override && (
                    <span className="inline-block bg-white text-black font-bold uppercase tracking-widest text-sm px-6 py-3 rounded-none hover:bg-gray-200 transition-colors">
                        {slot.cta_override}
                    </span>
                )}

                {!isMain && slot.link && (
                    <span className="text-white/80 text-sm font-medium border-b border-white/30 pb-0.5 group-hover:text-white group-hover:border-white transition-all">
                        View Details &rarr;
                    </span>
                )}
            </div>
        </>
    );

    // Wrapper: Link or Div
    if (slot.link) {
        return (
            <Link href={slot.link} className="block w-full h-full relative cursor-pointer">
                <Content />
            </Link>
        );
    }

    return (
        <div className="w-full h-full relative">
            <Content />
        </div>
    );
}
