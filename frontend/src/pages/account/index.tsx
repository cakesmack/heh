/**
 * Account Page
 * User profile with stats, badges, and check-in history
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, bookmarksAPI, analyticsAPI } from '@/lib/api';
import { CheckInHistory, EventResponse, UserDashboardStats, VenueClaim, OrganizerSummary } from '@/types';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [dashboardStats, setDashboardStats] = useState<UserDashboardStats | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInHistory[]>([]);
  const [submittedEvents, setSubmittedEvents] = useState<EventResponse[]>([]);
  const [bookmarks, setBookmarks] = useState<EventResponse[]>([]);
  const [myClaims, setMyClaims] = useState<VenueClaim[]>([]);
  const [myOrganizers, setMyOrganizers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'venues'>('overview');
  const [eventFilter, setEventFilter] = useState<'all' | 'upcoming' | 'pending' | 'past'>('all');

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch dashboard stats
        try {
          const dashStats = await api.users.getMyStats();
          setDashboardStats(dashStats);
        } catch (err) {
          console.error('Error fetching dashboard stats:', err);
        }

        // Fetch user's check-ins
        try {
          const checkInsData = await api.checkIns.myHistory();
          setCheckIns(checkInsData || []);
        } catch (err) {
          console.error('Error fetching check-ins:', err);
        }

        // Fetch user's submitted events
        try {
          const eventsData = await api.events.list({
            organizer_id: user.id,
            include_past: true
          });
          setSubmittedEvents(eventsData.events || []);
        } catch (err) {
          console.error('Error fetching submitted events:', err);
        }

        // Fetch venue claims
        try {
          const claimsData = await api.venueClaims.getMyClaims();
          setMyClaims(claimsData);
        } catch (err) {
          console.error('Error fetching venue claims:', err);
        }

        // Fetch bookmarks
        try {
          const bookmarksData = await bookmarksAPI.list();
          setBookmarks(bookmarksData.events || []);
        } catch (err) {
          console.error('Error fetching bookmarks:', err);
        }

        // Fetch organizer profiles
        try {
          const orgData = await api.organizers.list(user.id);
          setMyOrganizers(orgData.organizers || []);
        } catch (err) {
          console.error('Error fetching organizers:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [isAuthenticated, user]);

  const handleStopRecurrence = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to stop this recurring series? This will delete all future instances.')) {
      return;
    }

    try {
      await api.events.stopRecurrence(eventId);
      // Refresh list
      const eventsData = await api.events.list({});
      setSubmittedEvents(eventsData.events.filter(e => e.organizer_id === user?.id) || []);
    } catch (err) {
      console.error('Error stopping recurrence:', err);
      alert('Failed to stop recurrence');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h1>
          <p className="text-gray-600 mb-6">Please sign in to view your account.</p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Spinner size="lg" />
          <p className="text-gray-600 mt-4">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Profile</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Account</h1>
              <p className="text-gray-600">Welcome back, {user?.display_name || user?.username || user?.email}!</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`${activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`${activeTab === 'events'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              My Events
            </button>
            <button
              onClick={() => setActiveTab('venues')}
              className={`${activeTab === 'venues'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              My Venues
            </button>
          </nav>
        </div>

        {/* Tab Content: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* Stats Overview */}
            {dashboardStats && (
              <div className="space-y-6">
                {/* Top Row: Event Counts */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => { setActiveTab('events'); setEventFilter('all'); }}
                    className={`text-left p-6 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] ${eventFilter === 'all' ? 'bg-white shadow-xl ring-2 ring-emerald-500' : 'bg-white shadow-md hover:shadow-lg'}`}
                  >
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Events</p>
                    <p className="text-3xl font-bold text-gray-900">{dashboardStats.total_events}</p>
                  </button>
                  <button
                    onClick={() => { setActiveTab('events'); setEventFilter('upcoming'); }}
                    className={`text-left p-6 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] ${eventFilter === 'upcoming' ? 'bg-emerald-50 shadow-xl ring-2 ring-emerald-500' : 'bg-white shadow-md hover:shadow-lg'}`}
                  >
                    <p className="text-sm font-medium text-emerald-600 mb-1">Upcoming</p>
                    <p className="text-3xl font-bold text-emerald-700">{dashboardStats.upcoming_events}</p>
                  </button>
                  <button
                    onClick={() => { setActiveTab('events'); setEventFilter('pending'); }}
                    className={`text-left p-6 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] ${eventFilter === 'pending' ? 'bg-yellow-50 shadow-xl ring-2 ring-yellow-500' : 'bg-white shadow-md hover:shadow-lg'}`}
                  >
                    <p className="text-sm font-medium text-yellow-600 mb-1">Pending</p>
                    <p className="text-3xl font-bold text-yellow-700">{dashboardStats.pending_events}</p>
                  </button>
                  <button
                    onClick={() => { setActiveTab('events'); setEventFilter('past'); }}
                    className={`text-left p-6 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] ${eventFilter === 'past' ? 'bg-gray-50 shadow-xl ring-2 ring-gray-400' : 'bg-white shadow-md hover:shadow-lg'}`}
                  >
                    <p className="text-sm font-medium text-gray-500 mb-1">Past</p>
                    <p className="text-3xl font-bold text-gray-700">{dashboardStats.past_events}</p>
                  </button>
                </div>

                {/* Bottom Row: Engagement Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-6 rounded-2xl shadow-sm">
                    <p className="text-sm font-medium text-blue-600 mb-1">Total Views</p>
                    <p className="text-3xl font-bold text-blue-700">{dashboardStats.total_views}</p>
                  </div>
                  <div className="bg-pink-50 p-6 rounded-2xl shadow-sm">
                    <p className="text-sm font-medium text-pink-600 mb-1">Total Saves</p>
                    <p className="text-3xl font-bold text-pink-700">{dashboardStats.total_saves}</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-2xl shadow-sm">
                    <p className="text-sm font-medium text-purple-600 mb-1">Ticket Clicks</p>
                    <p className="text-3xl font-bold text-purple-700">{dashboardStats.total_ticket_clicks}</p>
                  </div>
                  <div className="bg-emerald-50 p-6 rounded-2xl shadow-sm">
                    <p className="text-sm font-medium text-emerald-600 mb-1">Check-ins</p>
                    <p className="text-3xl font-bold text-emerald-700">{dashboardStats.total_checkins}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* User Info Card */}
              <div className="lg:col-span-1">
                <Card>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-600">Display Name</p>
                      <p className="font-medium text-gray-900">{user?.display_name || user?.username || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Username</p>
                      <p className="font-medium text-gray-900">@{user?.username || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Email</p>
                      <p className="font-medium text-gray-900">{user?.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Member Since</p>
                      <p className="font-medium text-gray-900">
                        {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Organizer Profiles - Moved to Overview */}
              <div className="lg:col-span-2">
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Organizer Profiles ({myOrganizers.length})
                    </h2>
                    <Link
                      href="/account/organizers/create"
                      className="inline-flex items-center px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Profile
                    </Link>
                  </div>
                  {myOrganizers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {myOrganizers.map((org) => (
                        <div
                          key={org.id}
                          className="p-4 bg-gray-50 rounded-xl flex items-center justify-between hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mr-3 flex-shrink-0">
                              {org.logo_url ? (
                                <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <span className="text-base font-bold text-emerald-600">{org.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">{org.name}</h3>
                              <p className="text-xs text-gray-500 truncate">@{org.slug}</p>
                            </div>
                          </div>
                          <div className="flex space-x-1 ml-2">
                            <Link
                              href={`/groups/${org.slug}`}
                              className="p-1.5 text-gray-500 hover:text-emerald-600 rounded-lg hover:bg-white transition-colors"
                              title="View Profile"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>
                            <Link
                              href={`/account/organizers/${org.id}/edit`}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded-lg hover:bg-white transition-colors"
                              title="Edit Profile"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-500 mb-3">No organizer profiles yet.</p>
                      <p className="text-xs text-gray-400">Create a profile to promote events as a group.</p>
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Recent Check-Ins */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Recent Check-Ins ({checkIns.length})
                </h2>
              </div>

              {checkIns.length === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="text-gray-600 mb-2">No check-ins yet</p>
                  <p className="text-sm text-gray-500">
                    Start attending events to verify your attendance!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {checkIns.slice(0, 10).map((checkIn) => (
                    <div
                      key={checkIn.id}
                      className="flex items-start justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 mb-1 truncate">
                          {checkIn.event_title || 'Event'}
                        </h3>
                        {checkIn.venue_name && (
                          <p className="text-sm text-gray-600 mb-1 truncate">
                            at {checkIn.venue_name}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatDate(checkIn.checked_in_at || checkIn.timestamp)}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">
                          Verified
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab Content: My Events */}
        {activeTab === 'events' && (
          <div className="space-y-8 animate-fade-in">
            {/* Submitted Events */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    My Events
                  </h2>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {(['all', 'upcoming', 'pending', 'past'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setEventFilter(filter)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${eventFilter === filter ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <Link
                  href="/submit-event"
                  className="inline-flex items-center px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Event
                </Link>
              </div>

              {submittedEvents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {submittedEvents
                    .filter(event => {
                      if (eventFilter === 'all') return true;
                      const now = new Date();
                      const startDate = new Date(event.date_start);
                      const endDate = new Date(event.date_end);
                      if (eventFilter === 'upcoming') return startDate >= now;
                      if (eventFilter === 'past') return endDate < now;
                      if (eventFilter === 'pending') return event.status === 'pending';
                      return true;
                    })
                    .map((event) => (
                      <div
                        key={event.id}
                        className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] cursor-pointer shadow-sm hover:shadow-md transition-all"
                        onClick={() => router.push(`/events/${event.id}`)}
                      >
                        {/* Image */}
                        {event.image_url ? (
                          <img
                            src={event.image_url}
                            alt={event.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-700" />
                        )}

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Edit Button Overlay */}
                        <Link
                          href={`/events/${event.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                        >
                          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>

                        {/* Status Badges */}
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[calc(100%-40px)]">
                          {event.status === 'pending' && (
                            <span className="px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded uppercase">
                              Pending
                            </span>
                          )}
                          {event.featured && (
                            <span className="px-1.5 py-0.5 bg-blue-400 text-white text-[10px] font-bold rounded uppercase">
                              Featured
                            </span>
                          )}
                          {event.is_recurring && (
                            <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded uppercase">
                              Series
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <h3 className="font-semibold text-white text-sm leading-tight mb-0.5 line-clamp-2">
                            {event.title}
                          </h3>
                          <p className="text-white/70 text-[10px] mb-2">
                            {formatDate(event.date_start)}
                          </p>

                          {/* Analytics Stats */}
                          <div className="flex items-center space-x-3 pt-2 border-t border-white/10">
                            <div className="flex items-center text-white/90 text-[10px]" title="Total Views">
                              <svg className="w-3 h-3 mr-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              {event.view_count || 0}
                            </div>
                            <div className="flex items-center text-white/90 text-[10px]" title="Total Saves">
                              <svg className="w-3 h-3 mr-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                              {event.save_count || 0}
                            </div>
                            <div className="flex items-center text-white/90 text-[10px]" title="Ticket Clicks">
                              <svg className="w-3 h-3 mr-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                              </svg>
                              {event.ticket_click_count || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <p className="text-gray-500 mb-4">You haven't submitted any events yet.</p>
                  <Link
                    href="/submit-event"
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Submit your first event
                  </Link>
                </div>
              )}
            </Card>

            {/* Bookmarks */}
            <Card>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Saved Events ({bookmarks.length})
              </h2>
              {bookmarks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {bookmarks.map((event) => (
                    <div
                      key={event.id}
                      className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] cursor-pointer shadow-sm hover:shadow-md transition-all"
                      onClick={() => router.push(`/events/${event.id}`)}
                    >
                      {/* Image */}
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-500 to-gray-700" />
                      )}

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Content */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="font-semibold text-white text-sm leading-tight mb-0.5 line-clamp-2">
                          {event.title}
                        </h3>
                        <p className="text-white/70 text-[10px]">
                          {formatDate(event.date_start)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl">No saved events yet.</p>
              )}
            </Card>
          </div>
        )}

        {/* Tab Content: Venues */}
        {activeTab === 'venues' && (
          <div className="space-y-8 animate-fade-in">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  My Venue Claims ({myClaims.length})
                </h2>
                <Link
                  href="/venues"
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                >
                  Browse Venues
                </Link>
              </div>
              {myClaims.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {myClaims.map((claim) => {
                    const venue = (claim as any).venue;
                    return (
                      <div
                        key={claim.id}
                        className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] cursor-pointer shadow-sm hover:shadow-md transition-all"
                        onClick={() => router.push(`/venues/${claim.venue_id}`)}
                      >
                        {/* Image */}
                        {venue?.image_url ? (
                          <img
                            src={venue.image_url}
                            alt={venue.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700" />
                        )}

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Edit Button Overlay */}
                        {claim.status === 'approved' && (
                          <Link
                            href={`/venues/${claim.venue_id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                          >
                            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Link>
                        )}

                        {/* Status Badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${claim.status === 'approved' ? 'bg-green-400 text-green-900' :
                            claim.status === 'rejected' ? 'bg-red-400 text-red-900' :
                              'bg-yellow-400 text-yellow-900'
                            }`}>
                            {claim.status}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <h3 className="font-semibold text-white text-sm leading-tight mb-0.5 line-clamp-2">
                            {venue?.name || `Venue ${claim.venue_id.slice(0, 8)}...`}
                          </h3>
                          <p className="text-white/70 text-[10px] truncate">
                            {venue?.address || 'Address not available'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-500 mb-4">No venue claims yet.</p>
                  <Link
                    href="/venues"
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Browse venues to claim ownership
                  </Link>
                </div>
              )}
            </Card>
          </div>
        )}


      </div>
    </div>
  );
}
