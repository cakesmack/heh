import { useEffect, useState } from 'react';
import { recommendationsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import SmallEventCard from '@/components/events/SmallEventCard';
import { useAuth } from '@/hooks/useAuth';
import EventCardSkeleton from '@/components/events/EventCardSkeleton';

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
                const data = await recommendationsAPI.getRecommendations(4);
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
                <div className="max-w-7xl mx-auto">
                    <div className="px-4 sm:px-6 lg:px-8 mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
                        <p className="text-gray-600 mt-1">Events based on your interests and history</p>
                    </div>
                    <div className="
                        flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-4 no-scrollbar
                        md:grid md:grid-cols-4 md:gap-6 md:px-8 md:overflow-visible md:pb-0
                    ">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="snap-center shrink-0 w-[85vw] sm:w-[45vw] md:w-auto">
                                <EventCardSkeleton />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (events.length === 0) return null;

    return (
        <section className="py-12 bg-gray-50 border-t border-gray-200">
            <div className="max-w-7xl mx-auto">
                <div className="px-4 sm:px-6 lg:px-8 mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
                    <p className="text-gray-600 mt-1">Events based on your interests and history</p>
                </div>

                <div className="
                    flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-4 no-scrollbar
                    md:grid md:grid-cols-4 md:gap-6 md:px-8 md:overflow-visible md:pb-0
                ">
                    {events.map((event) => (
                        <div key={event.id} className="snap-center shrink-0 w-[85vw] sm:w-[45vw] md:w-auto">
                            <SmallEventCard event={event} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
