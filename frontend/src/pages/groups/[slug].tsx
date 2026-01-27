import { useRouter } from 'next/router';
import { GroupTeamList } from '@/components/groups/GroupTeamList';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Organizer, EventResponse } from '@/types';
import { Spinner } from '@/components/common/Spinner';
import { EventCard } from '@/components/events/EventCard';
import { FollowButton } from '@/components/common/FollowButton';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

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

const PhoneIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);



export default function OrganizerProfilePage() {
    const router = useRouter();
    const { slug } = router.query;
    const [organizer, setOrganizer] = useState<Organizer | null>(null);
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [eventsTotal, setEventsTotal] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'team'>('upcoming');
    const [isMember, setIsMember] = useState(false);
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [canEdit, setCanEdit] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Invite Modal State
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSendInvite = async () => {
        if (!organizer?.id) return;

        setIsInviting(true);
        setInviteMessage(null);

        try {
            await api.groups.createInvite(organizer.id, inviteEmail);
            setInviteMessage({ type: 'success', text: `Invitation sent to ${inviteEmail}` });
            setInviteEmail('');
            // Close after delay? Or let user see success message
        } catch (err) {
            console.error('Failed to send invite:', err);
            setInviteMessage({ type: 'error', text: 'Failed to send invitation. Please try again.' });
        } finally {
            setIsInviting(false);
        }
    };

    // 4. Fetch events based on activeTab
    const fetchEvents = async (reset = false) => {
        if (!organizer?.id) return;


        try {
            const currentCount = reset ? 0 : events.length;
            const skip = currentCount;
            // Map tab to time_range
            const timeRange = activeTab === 'past' ? 'past' : 'upcoming';

            setIsLoadingMore(true);
            const res = await api.events.list({
                organizer_profile_id: organizer.id,
                skip,
                limit: 12,
                time_range: timeRange
            });

            if (reset) {
                setEvents(res.events);
                setEventsTotal(res.total || 0);
            } else {
                setEvents(prev => [...prev, ...res.events]);
            }
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Initial fetch of Organizer
    useEffect(() => {
        if (!slug) return;

        const fetchOrganizer = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const organizerData = await api.organizers.getBySlug(slug as string);
                setOrganizer(organizerData);
            } catch (err) {
                console.error('Error fetching organizer:', err);
                setError('Organizer not found');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrganizer();
    }, [slug]);

    // Fetch events when organizer or activeTab changes
    useEffect(() => {
        if (organizer?.id) {
            fetchEvents(true);
        }
    }, [organizer?.id, activeTab]);

    const handleLoadMore = () => {
        if (!isLoadingMore) {
            fetchEvents(false);
        }
    };

    // Check permissions
    useEffect(() => {
        const checkPermissions = async () => {
            if (user && organizer) {
                // 1. Owner check
                const isOwner = user.id === organizer.user_id;
                // 2. Global Admin check
                const isGlobalAdmin = user.is_admin;

                // Determine if user is a member (for visibility of Members tab)
                if (isOwner) {
                    setIsMember(true);
                }

                if (isOwner || isGlobalAdmin) {
                    setCanEdit(true);
                }

                // 3. Group Member role check (Admin or Editor)
                try {
                    const membership = await api.groups.checkMembership(organizer.id);
                    // Case-insensitive role check
                    const role = membership?.role?.toLowerCase() || '';

                    if (membership && membership.is_member) {
                        setIsMember(true);
                    }

                    if (membership && ['admin', 'editor', 'owner'].includes(role)) {
                        setCanEdit(true);
                    } else if (!isOwner && !isGlobalAdmin) {
                        setCanEdit(false);
                    }
                } catch (err) {
                    // Not a member or error
                    setCanEdit(false);
                    if (!isOwner) setIsMember(false);
                }
            } else {
                setCanEdit(false);
            }
        };

        checkPermissions();
    }, [user, organizer]);

    // 3. Loading State blocks render to prevent "Guest View" flash
    if (isLoading || authLoading) {
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
                                        href={`/submit-event?organizer_profile_id=${organizer.id}`}
                                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none"
                                    >
                                        <PlusIcon className="w-4 h-4 mr-2" />
                                        Create Event
                                    </Link>
                                    <Link
                                        href={`/account/organizers/${organizer.id}/edit`}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                    >
                                        <PencilIcon className="w-4 h-4 mr-2" />
                                        Edit Page
                                    </Link>
                                    <button
                                        onClick={() => setIsInviteModalOpen(true)}
                                        className="inline-flex items-center px-4 py-2 border border-emerald-600 shadow-sm text-sm font-medium rounded-md text-emerald-700 bg-white hover:bg-emerald-50 focus:outline-none"
                                    >
                                        <UsersIcon className="w-4 h-4 mr-2" />
                                        Invite
                                    </button>
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
                                    href={`/submit-event?organizer_profile_id=${organizer.id}`}
                                    className="inline-flex items-center p-2 bg-emerald-600 text-white shadow-sm text-sm font-medium rounded-md hover:bg-emerald-700 focus:outline-none"
                                    title="Create Event"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </Link>
                                <Link
                                    href={`/account/organizers/${organizer.id}/edit`}
                                    className="inline-flex items-center p-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                    title="Edit Page"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={() => setIsInviteModalOpen(true)}
                                    className="inline-flex items-center p-2 border border-emerald-600 shadow-sm text-sm font-medium rounded-md text-emerald-700 bg-white hover:bg-emerald-50 focus:outline-none"
                                    title="Invite Members"
                                >
                                    <UsersIcon className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        <FollowButton targetId={organizer.id} targetType="group" />
                    </div>
                </div>

            </div>

            {/* About Section (Always Visible) */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
                        {(organizer.public_email || organizer.contact_number) && (
                            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                                {organizer.contact_number && (
                                    <div className="flex items-center text-gray-600">
                                        <PhoneIcon className="w-5 h-5 mr-3 text-emerald-600" />
                                        <span className="font-medium">{organizer.contact_number}</span>
                                    </div>
                                )}
                                {organizer.public_email && (
                                    <a
                                        href={`mailto:${organizer.public_email}`}
                                        className="w-full inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
                                    >
                                        <MailIcon className="w-5 h-5 mr-2" />
                                        Contact Organizer
                                    </a>
                                )}
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
            </div>

            {/* Tabs */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {[
                        { id: 'upcoming', name: 'Upcoming Events' },
                        { id: 'past', name: 'Past Events' },
                        ...(isMember ? [{ id: 'team', name: 'Members' }] : [])

                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                ${activeTab === tab.id
                                    ? 'border-emerald-500 text-emerald-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                            `}
                        >
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-12">
                    {activeTab === 'team' ? (
                        <GroupTeamList organizerId={organizer.id} />
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {activeTab === 'upcoming' ? 'Upcoming Events' : 'Past Events'}
                                </h2>
                                <span className="bg-emerald-100 text-emerald-800 text-sm font-medium px-3 py-1 rounded-full">
                                    {eventsTotal}
                                </span>
                            </div>

                            {events.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {events.map((event) => (
                                            <div key={event.id} className={activeTab === 'past' ? 'opacity-75 grayscale transition-all hover:grayscale-0 hover:opacity-100' : ''}>
                                                <EventCard event={event} />
                                            </div>
                                        ))}
                                    </div>

                                    {events.length < eventsTotal && (
                                        <div className="mt-8 flex justify-center">
                                            <Button
                                                variant="outline"
                                                onClick={handleLoadMore}
                                                isLoading={isLoadingMore}
                                            >
                                                Load More Events
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                                    <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500">
                                        {activeTab === 'upcoming'
                                            ? 'No upcoming events scheduled.'
                                            : 'No past events found.'}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Invite Modal */}
            {
                isInviteModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            {/* Background overlay */}
                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsInviteModalOpen(false)}></div>

                            {/* Modal panel */}
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                                <div>
                                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                                        <UsersIcon className="h-6 w-6 text-emerald-600" />
                                    </div>
                                    <div className="mt-3 text-center sm:mt-5">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                            Invite Member
                                        </h3>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500">
                                                Enter an email address to invite someone to this group. They will receive an email with a link to join.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-4">
                                    <Input
                                        label="Email Address"
                                        type="email"
                                        placeholder="new.member@example.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        disabled={isInviting}
                                    />

                                    {inviteMessage && (
                                        <div className={`text-sm p-3 rounded-md ${inviteMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {inviteMessage.text}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                    <Button
                                        variant="primary"
                                        className="w-full sm:col-start-2"
                                        onClick={handleSendInvite}
                                        isLoading={isInviting}
                                        disabled={!inviteEmail}
                                    >
                                        Send Invite
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="mt-3 w-full sm:mt-0 sm:col-start-1"
                                        onClick={() => {
                                            setIsInviteModalOpen(false);
                                            setInviteMessage(null);
                                            setInviteEmail('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

