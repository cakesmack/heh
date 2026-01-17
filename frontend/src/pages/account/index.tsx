/**
 * Account Page
 * User profile with stats, badges, and check-in history
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, analyticsAPI } from '@/lib/api';
import { EventResponse, UserDashboardStats, VenueClaim, OrganizerSummary, Category } from '@/types';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import { SettingsTab } from '@/components/account/SettingsTab';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, refreshUser } = useAuth();
  const [dashboardStats, setDashboardStats] = useState<UserDashboardStats | null>(null);

  const [submittedEvents, setSubmittedEvents] = useState<EventResponse[]>([]);
  const [hostedTotal, setHostedTotal] = useState(0);
  const [hostedPage, setHostedPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [bookmarks, setBookmarks] = useState<EventResponse[]>([]);
  const [bookmarksTotal, setBookmarksTotal] = useState(0);

  const [myClaims, setMyClaims] = useState<VenueClaim[]>([]);
  const [ownedVenues, setOwnedVenues] = useState<any[]>([]);
  const [myOrganizers, setMyOrganizers] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'venues' | 'settings'>('overview');
  const [eventFilter, setEventFilter] = useState<'all' | 'upcoming' | 'pending' | 'rejected' | 'past'>('all');
  const [eventsSubTab, setEventsSubTab] = useState<'hosting' | 'attending'>('attending');
  const [featuredStatus, setFeaturedStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Profile Editing State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ username: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Smart Default: If user has submitted events, default to 'hosting'
  // Only run this once when submittedEvents are first loaded and we are on the default 'attending'
  useEffect(() => {
    if (submittedEvents.length > 0 && eventsSubTab === 'attending' && !isLoading) {
      // We only auto-switch if the user hasn't manually interacted yet? 
      // For now, let's just do it if we are loading fresh. 
      // Actually, safely we can just set it if we detect they are an organizer on load.
      setEventsSubTab('hosting');
    }
  }, [submittedEvents.length, isLoading]);

  const handleEditClick = () => {
    if (user) {
      setEditForm({
        username: user.username || ''
      });
      setEditError(null);
      setIsEditingProfile(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setEditError(null);
  };

  const handleSaveProfile = async () => {
    setEditError(null);
    setIsSavingProfile(true);

    // Basic Validation
    if (!editForm.username.trim()) {
      setEditError('Username is required');
      setIsSavingProfile(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(editForm.username)) {
      setEditError('Username can only contain letters, numbers, and underscores');
      setIsSavingProfile(false);
      return;
    }

    try {
      await api.users.updateProfile({
        username: editForm.username
      });
      // Refresh global auth state
      await refreshUser();
      setIsEditingProfile(false);
      setIsSavingProfile(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile');
      setIsSavingProfile(false);
    }
  };

  // Auto-verify featured payment when redirected from Stripe
  useEffect(() => {
    const verifyFeaturedPayment = async () => {
      const { featured, booking_id, cancelled } = router.query;

      // Handle cancelled checkout
      if (cancelled === 'true') {
        setFeaturedStatus({ success: false, message: 'Featured promotion checkout was cancelled.' });
        // Clean up URL
        router.replace('/account', undefined, { shallow: true });
        return;
      }

      // Handle successful checkout - verify with backend
      if (featured === 'success' && booking_id && typeof booking_id === 'string') {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/featured/verify-session?booking_id=${booking_id}`,
            { credentials: 'include' }
          );
          const data = await response.json();

          if (data.success) {
            setFeaturedStatus({
              success: true,
              message: `Payment verified! Your event is now ${data.status === 'active' ? 'featured' : 'pending admin approval'}.`
            });
          } else {
            setFeaturedStatus({
              success: false,
              message: data.message || 'Failed to verify payment. Please contact support.'
            });
          }
        } catch (err) {
          console.error('Failed to verify featured payment:', err);
          setFeaturedStatus({
            success: false,
            message: 'Failed to verify payment. Please contact support.'
          });
        }

        // Clean up URL
        router.replace('/account', undefined, { shallow: true });
      }
    };

    if (router.isReady) {
      verifyFeaturedPayment();
    }
  }, [router.isReady, router.query]);

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



        // Fetch user's submitted events
        try {
          const eventsData = await api.events.list({
            organizer_id: user.id,
            include_past: true,
            limit: 12, // Pagination limit
            skip: 0
          });
          setSubmittedEvents(eventsData.events || []);
          setHostedTotal(eventsData.total || 0);
          setHostedPage(1);
        } catch (err) {
          console.error('Error fetching submitted events:', err);
        }

        // Fetch venue claims
        try {
          const claimsData = await api.venueClaims.getMyClaims();
          setMyClaims(claimsData);
        } catch (err) {
          console.error('Error fetching venue claims:', err);
          setClaimError(err instanceof Error ? err.message : 'Failed to load claims');
        }

        // Fetch owned venues
        try {
          const ownedData = await api.venues.list({ owner_id: user.id });
          setOwnedVenues(ownedData.venues);
        } catch (err) {
          console.error('Error fetching owned venues:', err);
        }

        // Fetch bookmarks
        try {
          const bookmarksData = await api.bookmarks.list();
          setBookmarks(bookmarksData.events || []);
          setBookmarksTotal(bookmarksData.total || 0);
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

        // Fetch categories for settings tab
        try {
          const categoriesData = await api.categories.list();
          setCategories(categoriesData.categories || []);
        } catch (err) {
          console.error('Error fetching categories:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [isAuthenticated, user]);

  const handleLoadMoreHosted = async () => {
    if (!user || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = hostedPage + 1;
      const eventsData = await api.events.list({
        organizer_id: user.id,
        include_past: true,
        limit: 12,
        skip: (nextPage - 1) * 12
      });

      setSubmittedEvents(prev => [...prev, ...(eventsData.events || [])]);
      setHostedPage(nextPage);
    } catch (err) {
      console.error('Error loading more hosted events:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">My Account</h1>
              <p className="text-gray-600">Welcome back, {user?.username || user?.email}!</p>

              {/* Compact Stats Row */}
              {dashboardStats && (
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Events Hosted: <span className="text-gray-900 font-bold">{hostedTotal}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                    Attending: <span className="text-gray-900 font-bold">{bookmarksTotal}</span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={logout}
              className="self-start md:self-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Featured Payment Status Banner */}
        {featuredStatus && (
          <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${featuredStatus.success
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
            <div className="flex items-center gap-3">
              {featuredStatus.success ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <p className="font-medium">{featuredStatus.message}</p>
            </div>
            <button
              onClick={() => setFeaturedStatus(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
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

            {/* Claim Error Debug */}
            {claimError && (
              <div className="text-red-500 text-xs px-2 py-1">! Claim Error: {claimError}</div>
            )}

            {/* Conditional "My Venues" Tab */}
            {/* Show if they have claims OR if they own venues */}
            {(myClaims.length > 0 || ownedVenues.length > 0) && (
              <button
                onClick={() => setActiveTab('venues')}
                className={`${activeTab === 'venues'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                My Venues
              </button>
            )}

            <button
              onClick={() => setActiveTab('settings')}
              className={`${activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Settings
            </button>
          </nav>
        </div>

        {/* Tab Content: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">

            {/* Compact Mode: Stats are now in header, so we just show content */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* User Info Card */}
              <div className="lg:col-span-1">
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
                    {!isEditingProfile && (
                      <button
                        onClick={handleEditClick}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {editError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                      {editError}
                    </div>
                  )}

                  <div className="space-y-4 text-sm">
                    {isEditingProfile ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-700 mb-1">Username</label>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                              @
                            </span>
                            <input
                              type="text"
                              value={editForm.username}
                              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                              className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-lg border border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                              placeholder="username"
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">Letters, numbers, and underscores only.</p>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSaveProfile}
                            disabled={isSavingProfile}
                            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {isSavingProfile ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={isSavingProfile}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>

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
                      </>
                    )}
                  </div>

                  {!isEditingProfile && (
                    <div className="mt-4 pt-4 border-t">
                      <Link
                        href="/forgot-password"
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Change Password
                      </Link>
                    </div>
                  )}
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


          </div>
        )}

        {/* Tab Content: My Events */}
        {activeTab === 'events' && (
          <div className="space-y-8 animate-fade-in">


            {/* Bookmarks */}
            <Card>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => setEventsSubTab('hosting')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${eventsSubTab === 'hosting' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Hosting
                    </button>
                    <button
                      onClick={() => setEventsSubTab('attending')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${eventsSubTab === 'attending' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Attending
                    </button>
                  </div>

                  {eventsSubTab === 'hosting' && (
                    <div className="hidden md:flex bg-gray-100 p-1 rounded-lg">
                      {(['all', 'upcoming', 'pending', 'rejected', 'past'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setEventFilter(filter)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${eventFilter === filter ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          {filter === 'rejected' ? 'Needs Attention' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {eventsSubTab === 'hosting' ? (
                  <Link
                    href="/submit-event"
                    className="inline-flex items-center px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Event
                  </Link>
                ) : (
                  <Link
                    href="/"
                    className="inline-flex items-center px-3 py-1.5 border border-emerald-600 text-emerald-600 text-sm font-medium rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    Browse Events
                  </Link>
                )}
              </div>

              {/* Mobile Filters for Hosting */}
              {eventsSubTab === 'hosting' && (
                <div className="md:hidden flex bg-gray-100 p-1 rounded-lg mb-4 overflow-x-auto">
                  {(['all', 'upcoming', 'pending', 'rejected', 'past'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setEventFilter(filter)}
                      className={`flex-1 px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${eventFilter === filter ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {filter === 'rejected' ? 'Needs Attention' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {eventsSubTab === 'hosting' ? (
                submittedEvents.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {submittedEvents
                        .filter(event => {
                          if (eventFilter === 'all') return true;
                          const now = new Date();
                          const startDate = new Date(event.date_start);
                          const endDate = new Date(event.date_end);
                          if (eventFilter === 'upcoming') return startDate >= now;
                          if (eventFilter === 'past') return endDate < now;
                          if (eventFilter === 'rejected') return event.status === 'rejected';
                          if (eventFilter === 'pending') return event.status === 'pending';
                          return true;
                        })
                        .map((event) => (
                          <div
                            key={event.id}
                            className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] cursor-pointer shadow-sm hover:shadow-md transition-all"
                            onClick={() => router.push(event.status === 'rejected' ? `/events/${event.id}/edit` : `/events/${event.id}`)}
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
                              {event.status === 'rejected' && (
                                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded uppercase">
                                  Rejected
                                </span>
                              )}
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
                                <div className="flex items-center text-white/90 text-[10px]" title="Going">
                                  <svg className="w-3 h-3 mr-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  {event.save_count || 0}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Load More Button */}
                    {submittedEvents.length < hostedTotal && (
                      <div className="mt-8 flex justify-center">
                        <button
                          onClick={handleLoadMoreHosted}
                          disabled={isLoadingMore}
                          className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoadingMore ? (
                            <span className="flex items-center">
                              <Spinner size="sm" className="mr-2" />
                              Loading...
                            </span>
                          ) : (
                            'Load More Events'
                          )}
                        </button>
                      </div>
                    )}
                  </>
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
                )
              ) : (
                bookmarks.length > 0 ? (
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
                          <div className="flex items-center text-white/90 text-[10px] mt-1" title="Attending">
                            <span className="bg-emerald-500/80 text-white px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Going</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <p className="text-gray-500 mb-4">You aren't attending any events yet.</p>
                    <Link
                      href="/"
                      className="text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Browse events to attend
                    </Link>
                  </div>
                )
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
                  Managed Venues ({ownedVenues.length + myClaims.length})
                </h2>
                <Link
                  href="/venues"
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                >
                  Browse Venues
                </Link>
              </div>

              {/* Owned Venues Section */}
              {ownedVenues.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Properties You Own</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {ownedVenues.map((venue) => (
                      <div
                        key={venue.id}
                        className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] cursor-pointer shadow-sm hover:shadow-md transition-all"
                        onClick={() => router.push(`/venues/${venue.id}`)}
                      >
                        {/* Image */}
                        {venue.image_url ? (
                          <img
                            src={venue.image_url}
                            alt={venue.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Edit Button */}
                        <Link
                          href={`/venues/${venue.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                        >
                          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>

                        <div className="absolute top-2 left-2">
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase bg-blue-500 text-white">Owner</span>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <h3 className="font-semibold text-white text-sm leading-tight mb-0.5 line-clamp-2">{venue.name}</h3>
                          <p className="text-white/70 text-[10px] truncate">{venue.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Claims Section */}
              {myClaims.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Claims</h3>
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
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab Content: Settings */}
        {activeTab === 'settings' && (
          <SettingsTab categories={categories} />
        )}

      </div >
    </div >
  );
}
