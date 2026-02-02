import Link from 'next/link';
import React from 'react';

export default function PopularLocations() {
    const cities = [
        { name: 'Inverness', slug: 'inverness' },
        { name: 'Skye', slug: 'skye' },
        { name: 'Fort William', slug: 'fort-william' },
        { name: 'Oban', slug: 'oban' },
        { name: 'Thurso', slug: 'thurso' },
        { name: 'Aviemore', slug: 'aviemore' },
    ];

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
