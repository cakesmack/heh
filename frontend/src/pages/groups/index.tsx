/**
 * Groups/Organizers Listing Page
 * Lists all organizer profiles with links to their pages
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { MobileDirectoryNav } from '@/components/common/MobileDirectoryNav';

interface Organizer {
    id: string;
    name: string;
    slug: string;
    bio?: string;
    website_url?: string;
    logo_url?: string;
    city?: string;
    group_type?: string;
    upcoming_events_count?: number;
}

const CITIES = ['Inverness', 'Fort William', 'Portree', 'Thurso', 'Wick', 'Ullapool', 'Aviemore', 'Nairn', 'Elgin', 'Dingwall'];
const GROUP_TYPES = ['Community Group', 'Venue', 'Business', 'Non-Profit', 'Other'];

export default function GroupsPage() {
    const { isAuthenticated } = useAuth();
    const [organizers, setOrganizers] = useState<Organizer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const fetchOrganizers = async () => {
        setIsLoading(true);
        try {
            const params: any = {};
            if (cityFilter) params.city = cityFilter;
            if (typeFilter) params.group_type = typeFilter;

            const data = await api.organizers.list(params);
            setOrganizers(data.organizers || []);
        } catch (err) {
            console.error('Failed to load organizers:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganizers();
    }, [cityFilter, typeFilter]);

    // Filter organizers by search query (client-side)
    const filteredOrganizers = organizers.filter((org) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            org.name.toLowerCase().includes(query) ||
            org.slug.toLowerCase().includes(query) ||
            (org.bio && org.bio.toLowerCase().includes(query))
        );
    });

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <MobileDirectoryNav />
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Groups & Organizers</h1>
                        <p className="text-gray-600 mt-1">
                            Discover event organizers, venues, and community groups in the Highlands
                        </p>
                    </div>
                    {isAuthenticated && (
                        <Link
                            href="/account/organizers/create"
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Group
                        </Link>
                    )}
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col lg:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search groups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white shadow-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <select
                            value={cityFilter}
                            onChange={(e) => setCityFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm text-sm font-medium text-gray-700 min-w-[140px]"
                        >
                            <option value="">All Cities</option>
                            {CITIES.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>

                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm text-sm font-medium text-gray-700 min-w-[140px]"
                        >
                            <option value="">All Types</option>
                            {GROUP_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {searchQuery && (
                    <p className="mt-2 text-sm text-gray-500">
                        Showing {filteredOrganizers.length} of {organizers.length} groups
                    </p>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Spinner size="lg" />
                    </div>
                ) : filteredOrganizers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredOrganizers.map((org) => (
                            <Link key={org.id} href={`/groups/${org.slug}`} className="group">
                                <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer h-full border-gray-100 hover:border-emerald-200 overflow-hidden flex flex-col relative">
                                    <div className="p-5 flex flex-col h-full">
                                        <div className="flex items-start gap-4 mb-4">
                                            {/* Logo - Constrained size */}
                                            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-emerald-100/50 shadow-sm">
                                                {org.logo_url ? (
                                                    <OptimizedImage
                                                        src={org.logo_url}
                                                        alt={org.name}
                                                        fill
                                                        className="object-cover"
                                                        variant="thumb"
                                                    />
                                                ) : (
                                                    <span className="text-xl font-bold text-emerald-600 uppercase">
                                                        {org.name.charAt(0)}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h2 className="text-xl font-extrabold text-gray-900 leading-tight group-hover:text-emerald-700 transition-colors">
                                                    {org.name}
                                                </h2>
                                                {org.city && (
                                                    <div className="flex items-center text-xs font-semibold text-gray-500 mt-1">
                                                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.244a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                        {org.city}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col flex-1">
                                            {org.bio && (
                                                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-4">
                                                    {org.bio}
                                                </p>
                                            )}

                                            <div className="mt-auto">
                                                {(org.upcoming_events_count || 0) > 0 ? (
                                                    <span className="text-xs font-medium text-emerald-600">
                                                        {org.upcoming_events_count} Upcoming {org.upcoming_events_count === 1 ? 'Event' : 'Events'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-medium text-gray-400">
                                                        View Details
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                {org.group_type || 'Organizer'}
                                            </span>
                                            <svg className="w-4 h-4 text-emerald-500 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                ) : searchQuery ? (
                    <Card>
                        <div className="text-center py-12">
                            <svg
                                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No groups found</h3>
                            <p className="text-gray-500 mb-4">Try a different search term</p>
                            <button
                                onClick={() => setSearchQuery('')}
                                className="text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                Clear search
                            </button>
                        </div>
                    </Card>
                ) : (
                    <Card>
                        <div className="text-center py-12">
                            <svg
                                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
                            <p className="text-gray-500 mb-6">Be the first to create a group or organization!</p>
                            {isAuthenticated ? (
                                <Link
                                    href="/account/organizers/create"
                                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    Create a Group
                                </Link>
                            ) : (
                                <Link
                                    href="/login?redirect=/account/organizers/create"
                                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    Sign in to Create
                                </Link>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
