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
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-100 border border-gray-100 animate-pulse flex-shrink-0 h-10 w-32">
            <div className="w-4 h-4 bg-gray-200 rounded-full" />
            <div className="w-16 h-4 bg-gray-200 rounded" />
        </div>
    );
}

export default function PopularLocations({ activeLocation, onSelectLocation, categorySlug }: PopularLocationsProps = {}) {
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
            <section className="py-3 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-row flex-nowrap overflow-x-auto whitespace-nowrap hide-scrollbar gap-3 pb-1">
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
        <section className="py-3 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-row flex-nowrap overflow-x-auto whitespace-nowrap hide-scrollbar gap-3 pb-1">
                    {locations.map((location) => {
                        const isActive = activeLocation === location.name;

                        if (onSelectLocation) {
                            return (
                                <button
                                    key={location.id || location.slug}
                                    type="button"
                                    onClick={() => onSelectLocation(location.name)}
                                    className={`group inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:translate-y-0 flex-shrink-0 cursor-pointer ${
                                        isActive
                                            ? 'bg-emerald-600 border border-emerald-600 text-white shadow-md'
                                            : 'bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:shadow-md hover:-translate-y-0.5'
                                    }`}
                                >
                                    <svg
                                        className={`w-4 h-4 transition-colors flex-shrink-0 ${
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
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={location.id || location.slug}
                                href={`/locations/${location.slug}`}
                                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0 flex-shrink-0"
                            >
                                <svg
                                    className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors flex-shrink-0"
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
