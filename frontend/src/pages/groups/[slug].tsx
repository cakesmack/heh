import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Organizer, EventResponse } from '@/types';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import { EventCard } from '@/components/events/EventCard';
import { FollowButton } from '@/components/common/FollowButton';

// Simple inline globe icon
const GlobeAltIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
);

// Social icons mapping (simple version)
const SocialIcon = ({ platform }: { platform: string }) => {
    // In a real app, you'd map platforms to specific icons (Facebook, Twitter, etc.)
    // For now, we use a generic globe or text
    return <span className="capitalize">{platform}</span>;
};

export default function OrganizerProfilePage() {
    const router = useRouter();
    const { slug } = router.query;
    const [organizer, setOrganizer] = useState<Organizer | null>(null);
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Fetch organizer by slug
                const organizerData = await api.organizers.getBySlug(slug as string);
                setOrganizer(organizerData);

                // Fetch events for this organizer
                if (organizerData?.id) {
                    try {
                        const eventsData = await api.events.list({ organizer_profile_id: organizerData.id });
                        setEvents(eventsData.events);
                    } catch (err) {
                        console.error('Error fetching events:', err);
                    }
                }
            } catch (err) {
                console.error('Error fetching organizer:', err);
                setError('Organizer not found');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [slug]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 py-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <Spinner size="lg" />
                    <p className="text-gray-600 mt-4">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error || !organizer) {
        return (
            <div className="min-h-screen bg-gray-50 py-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Organizer Not Found</h1>
                    <p className="text-gray-600 mb-6">{error || 'This organizer profile does not exist.'}</p>
                    <Link href="/events" className="text-emerald-600 hover:text-emerald-700">
                        &larr; Back to Events
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Cinematic Hero */}
            <div className="relative h-[40vh] min-h-[300px] overflow-hidden">
                {/* Blurred Background */}
                <div className="absolute inset-0">
                    {organizer.hero_image_url ? (
                        <img
                            src={organizer.hero_image_url}
                            alt=""
                            className="w-full h-full object-cover blur-xl scale-110"
                        />
                    ) : organizer.logo_url ? (
                        <img
                            src={organizer.logo_url}
                            alt=""
                            className="w-full h-full object-cover blur-xl scale-110"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-teal-700" />
                    )}
                    <div className="absolute inset-0 bg-black/50" />
                </div>

                {/* Back Button */}
                <Link href="/events" className="absolute top-6 left-6 inline-flex items-center text-sm text-white/80 hover:text-white bg-black/20 hover:bg-black/40 px-3 py-1.5 rounded-full backdrop-blur transition-colors z-10">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </Link>

                {/* Hero Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    {/* Logo */}
                    <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-white mb-4">
                        {organizer.logo_url ? (
                            <img src={organizer.logo_url} alt={organizer.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                <span className="text-4xl font-bold text-white">{organizer.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">{organizer.name}</h1>
                    {organizer.website_url && (
                        <a
                            href={organizer.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/80 hover:text-white flex items-center"
                        >
                            <GlobeAltIcon className="h-4 w-4 mr-1" />
                            {organizer.website_url.replace(/^https?:\/\//, '')}
                        </a>
                    )}
                    <div className="mt-4">
                        <FollowButton targetId={organizer.id} targetType="group" />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Bio & Socials */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
                            {organizer.bio ? (
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {organizer.bio}
                                </p>
                            ) : (
                                <p className="text-gray-500 italic">No description available.</p>
                            )}
                        </div>

                        <div className="md:col-span-1 space-y-4">
                            {organizer.social_links && Object.keys(organizer.social_links).length > 0 && (
                                <Card className="bg-gray-50 border-none">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Connect</h3>
                                    <div className="space-y-2">
                                        {Object.entries(organizer.social_links).map(([platform, url]) => (
                                            <a
                                                key={platform}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center text-gray-600 hover:text-emerald-600 transition-colors"
                                            >
                                                <span className="text-sm font-medium capitalize">{platform}</span>
                                                <svg className="w-4 h-4 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>

                {/* Events Section */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            {events.length}
                        </span>
                    </div>

                    {events.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {events.map((event) => (
                                <EventCard key={event.id} event={event} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                            <p className="text-gray-500">No upcoming events scheduled.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

