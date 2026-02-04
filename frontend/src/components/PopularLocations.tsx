import Link from 'next/link';
import React from 'react';
import { POPULAR_LOCATIONS } from '@/lib/constants';

export default function PopularLocations() {
    const cities = POPULAR_LOCATIONS;

    return (
        <div className="py-6 border-t border-gray-800">
            <div className="container mx-auto px-4">
                <p className="text-gray-500 text-sm mb-3 font-semibold uppercase tracking-wider">
                    Popular Locations
                </p>
                <div className="flex flex-wrap gap-4">
                    {cities.map((city) => (
                        <Link
                            key={city.slug}
                            href={`/locations/${city.slug}`}
                            className="text-gray-400 hover:text-white text-sm transition-colors"
                        >
                            Events in {city.name}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
