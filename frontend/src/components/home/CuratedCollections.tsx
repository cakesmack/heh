import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { collectionsAPI } from '@/lib/api';
import type { Collection } from '@/types';
import OptimizedImage from '@/components/ui/OptimizedImage';

export default function CuratedCollections() {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = 380; // Card width + gap
            current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        const fetchCollections = async () => {
            try {
                const data = await collectionsAPI.list();
                setCollections(data);
            } catch (err) {
                console.error('Failed to fetch collections:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchCollections();
    }, []);

    if (loading) {
        return (
            <section className="py-12 bg-gray-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                    <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-96 animate-pulse" />
                </div>
                <div
                    className="flex overflow-x-auto gap-6 pb-4 px-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="shrink-0 w-80 md:w-96 aspect-[16/9] bg-gray-200 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </section>
        );
    }

    if (collections.length === 0) return null;

    return (
        <section className="py-12 bg-gray-50 border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Curated Collections</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Hand-picked selections to help you find your perfect event
                </p>
            </div>

            {/* Netflix-style Horizontal Scroll Container */}
            <div className="relative group">
                {/* Left Scroll Button (Desktop Only) */}
                <button
                    onClick={() => scroll('left')}
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 text-stone-900 p-2.5 rounded-full shadow-md hover:bg-white hover:scale-110 transition-all ml-4 opacity-0 group-hover:opacity-100 focus:opacity-100 border border-gray-100"
                    aria-label="Scroll left"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Right Scroll Button (Desktop Only) */}
                <button
                    onClick={() => scroll('right')}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 text-stone-900 p-2.5 rounded-full shadow-md hover:bg-white hover:scale-110 transition-all mr-4 opacity-0 group-hover:opacity-100 focus:opacity-100 border border-gray-100"
                    aria-label="Scroll right"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {collections.map((collection, index) => (
                        <Link
                            key={collection.id}
                            href={collection.slug ? `/collections/${collection.slug}` : collection.target_link}
                            className={`snap-start shrink-0 w-80 md:w-96 aspect-[16/9] group relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 ${
                                index === 0 ? 'ml-4 md:ml-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''
                            } ${
                                index === collections.length - 1 ? 'mr-4 md:mr-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''
                            }`}
                        >
                            {/* Background Image */}
                            <div className="absolute inset-0">
                                <OptimizedImage
                                    src={collection.image_url || '/images/placeholder-collection.jpg'}
                                    alt={collection.title}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                    sizes="(max-width: 768px) 80vw, 40vw"
                                    variant="hero"
                                />
                            </div>

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-85 group-hover:opacity-75 transition-opacity z-10" />

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 p-6 w-full z-20">
                                <h3 className="text-xl font-bold text-white mb-1 group-hover:translate-x-1 transition-transform">
                                    {collection.title}
                                </h3>
                                {collection.subtitle && (
                                    <p className="text-white/80 text-sm font-medium group-hover:translate-x-1 transition-transform delay-75">
                                        {collection.subtitle}
                                    </p>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
