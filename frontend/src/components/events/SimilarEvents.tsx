import { useEffect, useState } from 'react';
import { recommendationsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import SmallEventCard from '@/components/events/SmallEventCard';

interface SimilarEventsProps {
    eventId: string;
}

export default function SimilarEvents({ eventId }: SimilarEventsProps) {
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSimilar = async () => {
            setLoading(true);
            try {
                const data = await recommendationsAPI.getSimilarEvents(eventId, 3);
                setEvents(data);
            } catch (err) {
                console.error('Failed to fetch similar events:', err);
            } finally {
                setLoading(false);
            }
        };

        if (eventId) {
            fetchSimilar();
        }
    }, [eventId]);

    if (loading) {
        return (
            <div className="mt-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">You Might Also Like</h2>
                <div className="animate-pulse flex space-x-4">
                    <div className="h-48 w-full bg-gray-200 rounded-lg"></div>
                </div>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="mt-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">You Might Also Like</h2>
                <p className="text-gray-500">No similar events found.</p>
            </div>
        );
    }

    return (
        <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">You Might Also Like</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {events.map((event) => (
                    <SmallEventCard key={event.id} event={event} />
                ))}
            </div>
        </div>
    );
}
