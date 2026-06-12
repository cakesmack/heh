import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { locationsAPI } from '@/lib/api';
import { GeographicHub } from '@/types';

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
            <section className="py-3 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-row flex-nowrap overflow-x-auto whitespace-nowrap hide-scrollbar gap-3 pb-1">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-10 w-32 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (locations.length === 0) return null;

    return (
        <section className="py-3 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-row flex-nowrap overflow-x-auto whitespace-nowrap hide-scrollbar gap-3 pb-1">
                    {locations.map((location) => (
                        <Link
                            key={location.slug}
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
                    ))}
                </div>
            </div>
        </section>
    );
}
