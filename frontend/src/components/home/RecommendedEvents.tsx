import { useEffect, useState } from 'react';
import Link from 'next/link';
import { recommendationsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import { useAuth } from '@/hooks/useAuth';

// Compact card variant for recommended events - image and title only
function CompactEventCard({ event }: { event: EventResponse }) {
    return (
        <Link href={`/events/${event.id}`} className="block group">
            <div className="relative overflow-hidden rounded-xl md:rounded-none">
                <div className="aspect-[4/3] overflow-hidden">
                    <img
                        src={event.image_url || '/images/event-placeholder.jpg'}
                        alt={event.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                </div>
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {/* Title at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-emerald-300 transition-colors">
                        {event.title}
                    </h3>
                    {event.category && (
                        <span className="text-emerald-400 text-xs font-medium mt-1 block">
                            {event.category.name}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}

export default function RecommendedEvents() {
    const { isAuthenticated } = useAuth();
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!isAuthenticated) {
                setLoading(false);
                return;
            }

            try {
                // Fetch 8 events for 4x2 grid
                const data = await recommendationsAPI.getRecommendations(8);
                setEvents(data);
            } catch (err) {
                console.error('Failed to fetch recommendations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [isAuthenticated]);

    if (!isAuthenticated) return null;

    if (loading) {
        return (
            <section className="py-12 bg-gray-50 border-t border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
                        <p className="text-gray-600 mt-1">Events based on your interests</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="aspect-[4/3] bg-gray-200 animate-pulse rounded-xl md:rounded-none" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (events.length === 0) return null;

    return (
        <section className="py-12 bg-gray-50 border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
                    <p className="text-gray-600 mt-1">Events based on your interests</p>
                </div>

                {/* 4x2 Grid on Desktop, 2-column on Mobile with Hybrid Radius */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {events.slice(0, 8).map((event) => (
                        <CompactEventCard key={event.id} event={event} />
                    ))}
                </div>
            </div>
        </section>
    );
}
