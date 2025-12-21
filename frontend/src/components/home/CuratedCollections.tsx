import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collectionsAPI } from '@/lib/api';
import type { Collection } from '@/types';

export default function CuratedCollections() {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);

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
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4 animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded w-96 mx-auto animate-pulse" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-64 bg-gray-200 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (collections.length === 0) return null;

    return (
        <section className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Curated Collections</h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Hand-picked selections to help you find your perfect event.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {collections.map((collection) => (
                        <Link
                            key={collection.id}
                            href={collection.target_link}
                            className="group relative aspect-[16/9] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
                        >
                            {/* Background Image */}
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                style={{
                                    backgroundImage: collection.image_url
                                        ? `url(${collection.image_url})`
                                        : 'url(/images/placeholder-collection.jpg)',
                                }}
                            />

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-70 transition-opacity" />

                            {/* Content */}
                            <div className="absolute bottom-0 left-0 p-8 w-full">
                                <h3 className="text-2xl font-bold text-white mb-1 group-hover:translate-x-1 transition-transform">
                                    {collection.title}
                                </h3>
                                {collection.subtitle && (
                                    <p className="text-white/90 font-medium group-hover:translate-x-1 transition-transform delay-75">
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
