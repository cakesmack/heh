import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { locationsAPI } from '@/lib/api';

export interface LocationHub {
    id: number;
    name: string;
    slug: string;
    hero_image_url?: string;
}

interface PopularLocationsProps {
    activeLocation?: string;
    onSelectLocation?: (name: string) => void;
    categorySlug?: string;
}

export function LocationPillSkeleton() {
    return (
        <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full bg-gray-100 border border-gray-100 animate-pulse flex-shrink-0 snap-start h-8 md:h-10 w-24 md:w-32">
            <div className="w-3.5 h-3.5 bg-gray-200 rounded-full" />
            <div className="w-12 md:w-16 h-3.5 bg-gray-200 rounded" />
        </div>
    );
}

export default function PopularLocations({ activeLocation, categorySlug }: PopularLocationsProps = {}) {
    const [locations, setLocations] = useState<LocationHub[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let isMounted = true;
        const fetchLocations = async () => {
            try {
                const data = await locationsAPI.list({ category_slug: categorySlug });
                if (isMounted && Array.isArray(data)) {
                    setLocations(data);
                }
            } catch (err) {
                console.error('Failed to fetch geographic hubs:', err);
                if (isMounted) setLocations([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchLocations();
        return () => {
            isMounted = false;
        };
    }, [categorySlug]);

    if (loading) {
        return (
            <section className="py-1.5 md:py-3 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible whitespace-nowrap scrollbar-hide snap-x gap-2 md:gap-3 pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <LocationPillSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (!locations || locations.length === 0) return null;

    return (
        <section className="py-1.5 md:py-3 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible whitespace-nowrap scrollbar-hide snap-x gap-2 md:gap-3 pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {locations.map((location) => {
                        const isActive = activeLocation === location.name || activeLocation === location.slug;

                        return (
                            <Link
                                key={location.id || location.slug}
                                href={`/locations/${location.slug}`}
                                className={`group inline-flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 active:translate-y-0 flex-shrink-0 snap-start ${
                                    isActive
                                        ? 'bg-emerald-600 border border-emerald-600 text-white shadow-sm md:shadow-md'
                                        : 'bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:shadow-md hover:-translate-y-0.5'
                                }`}
                            >
                                <svg
                                    className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-colors flex-shrink-0 ${
                                        isActive ? 'text-white' : 'text-gray-400 group-hover:text-emerald-500'
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                {location.name}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
