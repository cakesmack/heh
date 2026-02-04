import Link from 'next/link';
import Image from 'next/image';
import React from 'react';
import { POPULAR_LOCATIONS } from '@/lib/constants';

export default function PopularLocations() {
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
                    {POPULAR_LOCATIONS.map((city) => (
                        <Link
                            key={city.slug}
                            href={`/locations/${city.slug}`}
                            className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-900 border border-white/10 shadow-lg block"
                        >
                            {/* Background Image with Zoom */}
                            <div className="absolute inset-0 transform group-hover:scale-110 transition-transform duration-700 ease-out">
                                <Image
                                    src={city.imagePath || '/images/defaults/category_festivals.jpg'}
                                    alt={`Events in ${city.name}`}
                                    fill
                                    className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                />
                            </div>

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 p-4 w-full">
                                <h3 className="text-white font-bold text-lg leading-none mb-1 group-hover:text-emerald-300 transition-colors">
                                    {city.name}
                                </h3>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
