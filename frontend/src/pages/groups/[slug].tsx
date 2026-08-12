import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { GroupTeamList } from '@/components/groups/GroupTeamList';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Organizer, EventResponse } from '@/types';
import { Spinner } from '@/components/common/Spinner';
import { EventCard } from '@/components/events/EventCard';
import { FollowButton } from '@/components/common/FollowButton';
import { Input } from '@/components/common/Input';
import { Button, cn } from '@/components/ui/button';
import { Heart, HeartOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Card } from '@/components/common/Card';
import { useAuth } from '@/hooks/useAuth';
import { GroupRole } from '@/types';
import OptimizedImage from '@/components/ui/OptimizedImage';
import SocialShare from '@/components/common/SocialShare';
import { optimizeImage } from '@/utils/imageOptimizer';

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



interface GroupDetailPageProps {
    initialOrganizer: Organizer;
}

export default function OrganizerProfilePage({ initialOrganizer }: GroupDetailPageProps) {
    const router = useRouter();
    const { slug } = router.query;
    const [organizer, setOrganizer] = useState<Organizer | null>(initialOrganizer || null);
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [eventsTotal, setEventsTotal] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'team'>('upcoming');
    const [isMember, setIsMember] = useState(false);
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [canEdit, setCanEdit] = useState(false);
    const [isLoading, setIsLoading] = useState(!initialOrganizer);
    const [error, setError] = useState<string | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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

    // Initial fetch of Organizer (only if client-side navigation without SSR props)
    useEffect(() => {
        if (!slug || initialOrganizer) return;

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
    }, [slug, initialOrganizer]);

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

    const currentYear = new Date().getFullYear();
    const pageTitle = organizer ? `${organizer.name} Events, Dates & ${currentYear} Schedule` : 'Group Profile | Highland Events Hub';
    
    // SEO Summary Description binding
    const pageDescription = organizer?.description || organizer?.bio || `Find upcoming events, dates, and local information for ${organizer?.name}. View their complete, up-to-date schedule on the Highland Events Hub.`;
    
    // Fallback for URL if we need it
    const canonicalUrl = typeof window !== 'undefined' ? window.location.href : '';

    return (
        <>
            <Head>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDescription} />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDescription} />
                <meta property="og:type" content="profile" />
                <meta property="og:url" content={canonicalUrl} />
                {organizer?.logo_url && <meta property="og:image" content={organizer.logo_url} />}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={pageTitle} />
                <meta name="twitter:description" content={pageDescription} />
            </Head>
            <div className="min-h-screen bg-gray-50">
            {/* ═══ Dark Hero Section ═══ */}
            <div className="relative overflow-hidden bg-[#171717]">
                {/* Full-Width Blurred Background Image Layer */}
                {organizer.cover_image_url || organizer.hero_image_url ? (
                    <div
                        className="absolute inset-0 z-0"
                        style={{
                            backgroundImage: `url(${optimizeImage(organizer.cover_image_url || organizer.hero_image_url, 'hero')})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(4px)',
                            transform: 'scale(1.05)',
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 blur-sm scale-105" />
                )}
                
                {/* Horizontal Gradient Overlay */}
                <div 
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                        background: 'linear-gradient(to right, rgba(23, 23, 23, 0.5) 0%, #171717 65%, #171717 100%)'
                    }}
                />

                {/* Content Wrapper */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
                    {/* Back Button */}
                    <Link href="/groups" className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white mb-6 transition-colors">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Groups
                    </Link>

                    {/* Two-Column Grid: Image (40%) | Content (60%) */}
                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-24 lg:items-start">
                        {/* ─── Left Column: Logo ─── */}
                        <div className="w-full lg:w-[40%] flex-shrink-0">
                            <div className="relative overflow-hidden rounded-lg w-48 h-48 bg-white border-4 border-[#171717] shadow-2xl">
                                {organizer.logo_url ? (
                                    <img
                                        src={optimizeImage(organizer.logo_url, 'hero')}
                                        alt={organizer.name}
                                        className="w-full h-full block object-contain relative z-10"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center relative z-10">
                                        <span className="text-8xl font-bold text-white">{organizer.name.charAt(0)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── Right Column: Organizer Details ─── */}
                        <div className="w-full lg:w-[60%] flex flex-col justify-start pt-4 lg:pt-0">
                            {/* Top Section: Title & Logistics */}
                            <div className="mb-8">
                                {/* H1 Title */}
                                <div className="flex items-center gap-3 mb-4">
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                                        {organizer.name}
                                    </h1>
                                    {organizer.is_verified && (
                                        <div className="text-blue-500 shrink-0" title="Verified Organizer">
                                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Metadata Stack */}
                                <div className="flex flex-col gap-3 text-sm text-slate-300">
                                    <div className="flex items-center gap-3">
                                        <MapPinIcon className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                                        <span className="font-medium text-white">{organizer.city || 'Highlands'}</span>
                                        <span className="text-stone-600 mx-2">•</span>
                                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Group</span>
                                    </div>
                                </div>
                            </div>

                            {/* Utility Rows: Stacked Layout */}
                            <div className="mt-4 pt-6 border-t border-white/10 flex flex-col gap-6">
                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Share */}
                                    <SocialShare
                                        url={typeof window !== 'undefined' ? window.location.href : ''}
                                        title={organizer.name}
                                        description={organizer.bio}
                                        showLabel={false}
                                        className="!p-2.5 !w-auto !h-auto !rounded-full !bg-emerald-500/10 !border !border-emerald-500/30 !text-emerald-500 hover:!bg-emerald-500/20 hover:!border-emerald-500/50 hover:!text-emerald-400 !transition-colors"
                                    />
                                    
                                    {/* Follow */}
                                    <FollowButton 
                                        targetId={organizer.id} 
                                        targetType="group" 
                                        iconOnly={true}
                                        className="!p-2.5 !w-auto !h-auto !rounded-full !bg-red-500/10 !border !border-red-500/30 !text-red-500 hover:!bg-red-500/20 hover:!border-red-500/50 hover:!text-red-400 !transition-colors" 
                                    />

                                    {/* Admin Actions Box */}
                                    {canEdit && (
                                        <div className="bg-slate-800/60 p-1.5 sm:p-2 rounded-full border border-white/5 flex items-center gap-1">
                                            <Link
                                                href={`/submit-event?organizer_profile_id=${organizer.id}`}
                                                className="flex items-center text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors shrink-0"
                                            >
                                                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Create Event
                                            </Link>
                                            <Link
                                                href={`/account/organizers/${organizer.id}/edit`}
                                                className="flex items-center text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors shrink-0"
                                            >
                                                <PencilIcon className="w-3.5 h-3.5 mr-1.5" />
                                                Edit Details
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                {/* Connect Data */}
                                {(organizer.public_email || organizer.contact_number || organizer.website_url || organizer.social_website || organizer.social_facebook || organizer.social_instagram) && (
                                    <div className="flex flex-col gap-3">
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connect</h3>
                                        <div className="flex flex-wrap items-center gap-4">
                                            {organizer.public_email && (
                                                <a href={`mailto:${organizer.public_email}`} className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors">
                                                    <MailIcon className="w-4 h-4 text-emerald-400" />
                                                    {organizer.public_email}
                                                </a>
                                            )}
                                            {organizer.contact_number && (
                                                <a href={`tel:${organizer.contact_number}`} className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-emerald-400 transition-colors">
                                                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                    {organizer.contact_number}
                                                </a>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            {(organizer.social_website || organizer.website_url) && (
                                                <a href={organizer.social_website || organizer.website_url} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-slate-800/60 border border-white/5 text-slate-300 hover:bg-slate-700 hover:text-emerald-400 transition-colors" title="Website">
                                                    <GlobeIcon className="w-4 h-4" />
                                                </a>
                                            )}
                                            {organizer.social_facebook && (
                                                <a href={organizer.social_facebook} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-slate-800/60 border border-white/5 text-slate-300 hover:bg-slate-700 hover:text-blue-400 transition-colors" title="Facebook">
                                                    <FacebookIcon className="w-4 h-4" />
                                                </a>
                                            )}
                                            {organizer.social_instagram && (
                                                <a href={organizer.social_instagram} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-slate-800/60 border border-white/5 text-slate-300 hover:bg-slate-700 hover:text-pink-400 transition-colors" title="Instagram">
                                                    <InstagramIcon className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="bg-gray-50 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Consolidated Overview Section */}
                <div className="max-w-4xl mb-16">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                        Overview
                    </h2>
                    {organizer.bio ? (
                        <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-wrap">
                            {organizer.bio}
                        </p>
                    ) : (
                        <p className="text-gray-400 italic bg-white rounded-lg p-6 border border-dashed border-gray-200">
                            This organizer hasn't added an overview yet.
                        </p>
                    )}
                </div>

                {/* Tabs & Events Feed */}
                <div className="mb-20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 mb-10 gap-6">
                        <nav className="flex space-x-10">
                            {[
                                { id: 'upcoming', name: 'Upcoming Events' },
                                { id: 'past', name: 'Past History' },
                                ...(isMember ? [{ id: 'team', name: 'Team Members' }] : [])
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`
                                        whitespace-nowrap py-5 px-1 border-b-4 font-bold text-sm transition-all
                                        ${activeTab === tab.id
                                            ? 'border-emerald-500 text-emerald-700'
                                            : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}
                                    `}
                                >
                                    {tab.name}
                                </button>
                            ))}
                        </nav>
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="text-gray-400 font-bold uppercase text-xs tracking-widest">Displaying</span>
                            <span className="bg-gray-900 text-white text-xs font-black px-3 py-1 rounded-full">{eventsTotal} Results</span>
                        </div>
                    </div>

                    {activeTab === 'team' ? (
                        <div className="bg-white rounded-3xl p-8 border border-gray-100">
                            <GroupTeamList organizerId={organizer.id} />
                        </div>
                    ) : (
                        <div>
                            {events.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                                        {events.map((event) => (
                                            <div key={event.id} className={activeTab === 'past' ? 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all' : 'group'}>
                                                <EventCard event={event} />
                                            </div>
                                        ))}
                                    </div>
                                    {events.length < eventsTotal && (
                                        <div className="mt-16 flex justify-center">
                                            <button
                                                onClick={handleLoadMore}
                                                disabled={isLoadingMore}
                                                className="px-10 py-4 border-2 border-emerald-600 text-emerald-700 font-black rounded-full hover:bg-emerald-600 hover:text-white transition-all shadow-xl shadow-emerald-50 flex items-center justify-center gap-2"
                                            >
                                                {isLoadingMore && <Spinner size="sm" />}
                                                Load More Results
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8">
                                        <CalendarIcon className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">No activity found</h3>
                                    <p className="text-gray-500 max-w-sm mx-auto font-medium">
                                        {activeTab === 'upcoming'
                                            ? 'This organizer hasn\'t scheduled any future events. Check back soon for updates!'
                                            : 'We couldn\'t find any past event history for this profile.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >

            {/* Invite Modal */}
            {
                isInviteModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setIsInviteModalOpen(false)}></div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-3xl px-8 pt-10 pb-8 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="text-center">
                                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-50 mb-6">
                                        <UsersIcon className="h-8 w-8 text-emerald-600" />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 mb-2">Invite Collaborator</h3>
                                    <p className="text-gray-500 font-medium mb-8">
                                        Invite a member to help manage {organizer.name}.
                                    </p>
                                </div>
                                <div className="space-y-6 mb-10">
                                    <Input
                                        label="Email Address"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        disabled={isInviting}
                                        className="rounded-xl border-gray-200 focus:ring-emerald-500"
                                    />
                                    {inviteMessage && (
                                        <div className={`p-4 rounded-xl font-bold text-sm ${inviteMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {inviteMessage.text}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleSendInvite}
                                        disabled={!inviteEmail || isInviting}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-full font-black shadow-lg shadow-emerald-100/20 active:scale-95 transition-all flex items-center justify-center"
                                    >
                                        {isInviting ? <Spinner size="sm" /> : 'Send Invitation'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsInviteModalOpen(false);
                                            setInviteMessage(null);
                                            setInviteEmail('');
                                        }}
                                        className="w-full py-4 rounded-full font-bold text-gray-400 hover:bg-gray-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
        </>
    );
}

export const getServerSideProps: GetServerSideProps<GroupDetailPageProps> = async (context) => {
    const { slug } = context.params as { slug: string };

    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';
        
        // Fetch Organizer data by slug
        const res = await fetch(`${apiUrl}/api/organizers/slug/${slug}`);

        if (res.status === 404 || !res.ok) {
            return { notFound: true };
        }

        const organizer: Organizer = await res.json();
        if (!organizer) {
            return { notFound: true };
        }

        const baseUrl = 'https://highlandeventshub.co.uk';

        // Construct description
        const description = organizer.bio
            ? organizer.bio.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...'
            : `Discover events, gigs, and festivals organized by ${organizer.name} on Highland Events Hub.`;

        // Use the Cloudflare 'og' variant for strictly 1200x630
        const imageToOptimize = organizer.cover_image_url || organizer.hero_image_url || organizer.logo_url;
        const optimizedOgUrl = imageToOptimize ? optimizeImage(imageToOptimize, 'og') : null;
        const ogImage = optimizedOgUrl
            ? (optimizedOgUrl.startsWith('http') ? optimizedOgUrl : `${baseUrl}/${optimizedOgUrl.startsWith('/') ? optimizedOgUrl.substring(1) : optimizedOgUrl}`)
            : `${baseUrl}/images/og-default.jpg`;

        return {
            props: {
                initialOrganizer: organizer,
                meta: {
                    title: `${organizer.name} | Organizer on Highland Events Hub`,
                    description: description,
                    url: `${baseUrl}/groups/${slug}`,
                    image: ogImage,
                    type: 'website',
                }
            },
        };
    } catch (error) {
        console.error('SSR Error fetching organizer:', error);
        return { notFound: true };
    }
};
