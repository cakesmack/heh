/**
 * Featured Venues Carousel
 * Horizontal scrolling list of venue logos with names
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { venuesAPI } from '@/lib/api';
import { VenueResponse } from '@/types';

export default function FeaturedVenues() {
    const [venues, setVenues] = useState<VenueResponse[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVenues = async () => {
            try {
                // Fetch popular/featured venues - limit to 8 for single row feel
                const data = await venuesAPI.list({ limit: 8, sort_by: 'activity' });
                setVenues(data.venues || []);
            } catch (error) {
                console.error('Failed to fetch venues:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVenues();
    }, []);

    if (loading) {
        return (
            <section className="py-8 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Popular Venues</h2>
                </div>
                <div
                    className="flex overflow-x-auto gap-6 pb-4 px-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="shrink-0 flex flex-col items-center">
                            <div className="w-24 h-24 rounded-lg bg-gray-200 animate-pulse" />
                            <div className="w-20 h-4 mt-3 rounded bg-gray-200 animate-pulse" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (venues.length === 0) return null;

    return (
        <section className="py-8 bg-gray-50">
            {/* Header */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Popular Venues</h2>
                <Link href="/venues" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">
                    View All →
                </Link>
            </div>

            {/* Horizontal Scroll */}
            <div
                className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-4"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {venues.map((venue, index) => (
                    <Link
                        key={venue.id}
                        href={`/venues/${venue.id}`}
                        className={`snap-center shrink-0 flex flex-col items-center group ${index === 0 ? 'ml-4 md:ml-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''
                            } ${index === venues.length - 1 ? 'mr-4 md:mr-[max(1rem,calc((100vw-80rem)/2+1rem))]' : ''}`}
                    >
                        {/* Squircle Image -> Circle Image */}
                        <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-white shadow-lg border-4 border-white group-hover:border-emerald-200 group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                            {venue.image_url ? (
                                <Image
                                    src={venue.image_url}
                                    alt={venue.name}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 256px, 320px"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                                    <span className="text-3xl text-white font-bold">
                                        {venue.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Venue Name */}
                        <p className="mt-3 text-sm font-medium text-gray-900 text-center max-w-[100px] truncate group-hover:text-emerald-600 transition-colors">
                            {venue.name}
                        </p>

                        {/* Location subtitle */}
                        {venue.address && (
                            <p className="text-xs text-gray-500 text-center max-w-[100px] truncate">
                                {venue.address.split(',')[0]}
                            </p>
                        )}
                    </Link>
                ))}
            </div>
        </section>
    );
}
