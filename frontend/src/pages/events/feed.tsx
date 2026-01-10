/**
 * My Feed Page
 * Shows events from followed venues and organizers
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { EventResponse } from '@/types';
import { EventCard } from '@/components/events/EventCard';
import { Spinner } from '@/components/common/Spinner';

export default function MyFeedPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated) {
            router.push('/login?redirect=/events/feed');
            return;
        }

        const fetchFeed = async () => {
            setLoading(true);
            try {
                const data = await api.social.getFeed();
                setEvents(data || []);
            } catch (err) {
                console.error('Error fetching feed:', err);
                setError('Failed to load your feed');
            } finally {
                setLoading(false);
            }
        };

        fetchFeed();
    }, [isAuthenticated, authLoading, router]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-50 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <Spinner size="lg" />
                    <p className="text-gray-600 mt-4">Loading your feed...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>My Feed - Highland Events Hub</title>
                <meta name="description" content="Events from venues and organizers you follow" />
            </Head>

            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">My Feed</h1>
                            <p className="text-gray-600 mt-1">
                                Events from venues and organizers you follow
                            </p>
                        </div>
                        <Link
                            href="/events"
                            className="text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                            Browse All Events →
                        </Link>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error ? (
                    <div className="text-center py-12">
                        <p className="text-red-600">{error}</p>
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Your Feed is Empty</h3>
                        <p className="text-gray-600 mb-8 max-w-md mx-auto">
                            Follow categories, venues, or groups to see their events here!
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <Link
                                href="/categories"
                                className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                Browse Categories
                            </Link>
                            <Link
                                href="/venues"
                                className="px-5 py-2.5 bg-white text-emerald-600 font-medium rounded-lg border border-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                                Browse Venues
                            </Link>
                            <Link
                                href="/groups"
                                className="px-5 py-2.5 bg-white text-emerald-600 font-medium rounded-lg border border-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                                Browse Groups
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
