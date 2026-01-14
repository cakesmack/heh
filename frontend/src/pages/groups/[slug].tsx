import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Organizer, EventResponse } from '@/types';
import { Spinner } from '@/components/common/Spinner';
import { EventCard } from '@/components/events/EventCard';
import { FollowButton } from '@/components/common/FollowButton';

import { useAuth } from '@/hooks/useAuth';
import { GroupRole } from '@/types';

// Icons
const PencilIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
);
const MapPinIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const MailIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

const GlobeIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
);

export default function OrganizerProfilePage() {
    const router = useRouter();
    const { slug } = router.query;
    const [organizer, setOrganizer] = useState<Organizer | null>(null);
    const [events, setEvents] = useState<EventResponse[]>([]);
    const { user, isAuthenticated } = useAuth();
    const [canEdit, setCanEdit] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const organizerData = await api.organizers.getBySlug(slug as string);
                setOrganizer(organizerData);

                if (organizerData?.id) {
                    try {
                        const eventsData = await api.events.list({ organizer_profile_id: organizerData.id });
                        setEvents(eventsData.events);
                    } catch (err) {
                        console.error('Error fetching events:', err);
                    }

                    // Check permissions if logged in
                    if (isAuthenticated && user) {
                        // Check if creator (robust fallback)
                        if (organizerData.user_id === user.id) {
                            setCanEdit(true);
                        } else {
                            try {
                                const membership = await api.groups.checkMembership(organizerData.id);
                                if (membership && (membership.role === 'owner' || membership.role === 'admin')) {
                                    setCanEdit(true);
                                }
                            } catch (err) {
                                // Not a member or error checking - ignore
                            }
                        }
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
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <Spinner size="lg" />
                    <p className="text-gray-600 mt-4">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error || !organizer) {
        return (
            <div className="min-h-screen bg-gray-50 py-12">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Organizer Not Found</h1>
                    <p className="text-gray-600 mb-6">{error || 'This organizer profile does not exist.'}</p>
                    <Link href="/events" className="text-emerald-600 hover:text-emerald-700">
                        &larr; Back to Events
                    </Link>
                </div>
            </div>
        );
    }

    const hasSocials = organizer.social_facebook || organizer.social_instagram || organizer.social_website || organizer.website_url;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Cover Image (3:1 aspect ratio) */}
            <div className="relative h-48 md:h-64 lg:h-80 overflow-hidden">
                {organizer.cover_image_url || organizer.hero_image_url ? (
                    <img
                        src={organizer.cover_image_url || organizer.hero_image_url}
                        alt={`${organizer.name} cover`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600" />
                )}
                <div className="absolute inset-0 bg-black/20" />

                {/* Back Button */}
                <Link
                    href="/events"
                    className="absolute top-4 left-4 inline-flex items-center text-sm text-white bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-full backdrop-blur transition-colors"
                >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </Link>
            </div>

            {/* Profile Header - Overlapping Logo */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="relative -mt-16 mb-6">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between">
                        {/* Logo + Name */}
                        <div className="flex items-end space-x-4">
                            <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-white">
                                {organizer.logo_url ? (
                                    <img src={organizer.logo_url} alt={organizer.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                        <span className="text-4xl md:text-5xl font-bold text-white">{organizer.name.charAt(0)}</span>
                                    </div>
                                )}
                            </div>
                            <div className="mb-2">
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{organizer.name}</h1>
                            </div>
                        </div>

                        {/* Follow Button (desktop) */}
                        <div className="hidden md:flex items-center space-x-3 mt-4 md:mt-0">
                            {canEdit && (
                                <>
                                    <Link
                                        href={`/account/organizers/${organizer.id}/edit`}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                    >
                                        <PencilIcon className="w-4 h-4 mr-2" />
                                        Edit Profile
                                    </Link>
                                    <Link
                                        href={`/account/organizers/${organizer.id}/edit?tab=team`}
                                        className="inline-flex items-center px-4 py-2 border border-emerald-600 shadow-sm text-sm font-medium rounded-md text-emerald-700 bg-white hover:bg-emerald-50 focus:outline-none"
                                    >
                                        <UsersIcon className="w-4 h-4 mr-2" />
                                        Invite
                                    </Link>
                                </>
                            )}
                            <FollowButton targetId={organizer.id} targetType="group" />
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-8 flex flex-wrap items-center gap-6">
                    {organizer.city && (
                        <div className="flex items-center text-gray-600">
                            <MapPinIcon className="w-5 h-5 mr-2 text-emerald-600" />
                            <span className="font-medium">{organizer.city}</span>
                        </div>
                    )}
                    <div className="flex items-center text-gray-600">
                        <CalendarIcon className="w-5 h-5 mr-2 text-emerald-600" />
                        <span className="font-medium">{organizer.total_events_hosted || 0} Events Hosted</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                        <UsersIcon className="w-5 h-5 mr-2 text-emerald-600" />
                        <span className="font-medium">{organizer.follower_count || 0} Followers</span>
                    </div>

                    {/* Follow Button (mobile) */}
                    <div className="md:hidden ml-auto flex items-center space-x-3">
                        {canEdit && (
                            <>
                                <Link
                                    href={`/account/organizers/${organizer.id}/edit`}
                                    className="inline-flex items-center p-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                    title="Edit Profile"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </Link>
                                <Link
                                    href={`/account/organizers/${organizer.id}/edit?tab=team`}
                                    className="inline-flex items-center p-2 border border-emerald-600 shadow-sm text-sm font-medium rounded-md text-emerald-700 bg-white hover:bg-emerald-50 focus:outline-none"
                                    title="Invite Members"
                                >
                                    <UsersIcon className="w-4 h-4" />
                                </Link>
                            </>
                        )}
                        <FollowButton targetId={organizer.id} targetType="group" />
                    </div>
                </div>

                {/* Main Content: 2-Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    {/* About Section (2/3 width) */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
                            {organizer.bio ? (
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{organizer.bio}</p>
                            ) : (
                                <p className="text-gray-500 italic">No description available.</p>
                            )}
                        </div>
                    </div>

                    {/* Sidebar: Quick Info (1/3 width) */}
                    <div className="space-y-6">
                        {/* Contact Organizer */}
                        {organizer.public_email && (
                            <div className="bg-white rounded-xl shadow-sm p-6">
                                <a
                                    href={`mailto:${organizer.public_email}`}
                                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
                                >
                                    <MailIcon className="w-5 h-5 mr-2" />
                                    Contact Organizer
                                </a>
                            </div>
                        )}

                        {/* Social Links */}
                        {hasSocials && (
                            <div className="bg-white rounded-xl shadow-sm p-6">
                                <h3 className="text-sm font-semibold text-gray-900 mb-4">Connect With Us</h3>
                                <div className="space-y-3">
                                    {(organizer.social_website || organizer.website_url) && (
                                        <a
                                            href={organizer.social_website || organizer.website_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-gray-600 hover:text-emerald-600 transition-colors"
                                        >
                                            <GlobeIcon className="w-5 h-5 mr-3" />
                                            <span>Website</span>
                                        </a>
                                    )}
                                    {organizer.social_facebook && (
                                        <a
                                            href={organizer.social_facebook}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
                                        >
                                            <FacebookIcon className="w-5 h-5 mr-3" />
                                            <span>Facebook</span>
                                        </a>
                                    )}
                                    {organizer.social_instagram && (
                                        <a
                                            href={organizer.social_instagram}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-gray-600 hover:text-pink-600 transition-colors"
                                        >
                                            <InstagramIcon className="w-5 h-5 mr-3" />
                                            <span>Instagram</span>
                                        </a>
                                    )}
                                    {organizer.public_email && (
                                        <a
                                            href={`mailto:${organizer.public_email}`}
                                            className="flex items-center text-gray-600 hover:text-emerald-600 transition-colors"
                                        >
                                            <MailIcon className="w-5 h-5 mr-3" />
                                            <span>Email</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
                        <span className="bg-emerald-100 text-emerald-800 text-sm font-medium px-3 py-1 rounded-full">
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
                            <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500">No upcoming events scheduled.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

