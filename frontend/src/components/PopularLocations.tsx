import Link from 'next/link';
import OptimizedImage from '@/components/ui/OptimizedImage';
import React, { useEffect, useState } from 'react';
import { locationsAPI } from '@/lib/api';
import { GeographicHub } from '@/types';

const FALLBACK_IMAGE = '/images/defaults/category_festivals.jpg';

export default function PopularLocations() {
    const [locations, setLocations] = useState<GeographicHub[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        locationsAPI.list()
            .then((data) => setLocations(data))
            .catch((err) => console.error('Failed to fetch locations:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <section className="py-16 bg-stone-950">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-10">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">Explore by Location</h2>
                            <p className="text-gray-400">Discover events happening in your local area</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="aspect-[4/3] rounded-xl bg-gray-800 animate-pulse" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (locations.length === 0) return null;

    return (
        <section className="py-16 bg-stone-950">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-end mb-10">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">Explore by Location</h2>
                        <p className="text-gray-400">Discover events happening in your local area</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {locations.map((location) => (
                        <Link
                            key={location.slug}
                            href={`/locations/${location.slug}`}
                            className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-900 border border-white/10 shadow-lg block"
                        >
                            {/* Background Image with Zoom */}
                            <div className="absolute inset-0 transform group-hover:scale-110 transition-transform duration-700 ease-out">
                                <OptimizedImage
                                    src={location.hero_image_url || FALLBACK_IMAGE}
                                    alt={`Events in ${location.name}`}
                                    fill
                                    className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                    variant="thumb"
                                />
                            </div>

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 p-4 w-full">
                                <h3 className="text-white font-bold text-lg leading-none mb-1 group-hover:text-emerald-300 transition-colors">
                                    {location.name}
                                </h3>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
