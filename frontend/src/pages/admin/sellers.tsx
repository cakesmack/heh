import React, { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import AdminLayout from '@/components/admin/AdminLayout';
import { apiFetch } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface StripeAccountDetails {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

interface OrganizerItem {
  id: string;
  name: string;
  slug: string;
  is_verified: boolean;
  stripe_account?: StripeAccountDetails | null;
}

interface SellerItem {
  user_id: string;
  email: string;
  username: string;
  seller_status: string;
  seller_tier: number;
  display_status: 'active' | 'pending' | 'frozen';
  status_label: string;
  is_auto_verified: boolean;
  has_active_stripe: boolean;
  organizers: OrganizerItem[];
  events_count: number;
  created_at: string | null;
  updated_at: string | null;
}

interface SellerDirectoryResponse {
  sellers: SellerItem[];
  stats: {
    total_sellers: number;
    active_verified: number;
    pending_setup: number;
    frozen_revoked: number;
    connected_stripe: number;
  };
}

export default function SellersAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SellerDirectoryResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'frozen'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<SellerDirectoryResponse>('/api/admin/sellers/directory');
      setData(res);
    } catch (err: any) {
      console.error('Failed to load sellers directory:', err);
      toast.error(err.message || 'Failed to load sellers directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_admin) {
      fetchDirectory();
    }
  }, [user]);

  const handleFreezeSeller = async (seller: SellerItem) => {
    const reason = prompt(`Enter reason for freezing/revoking seller privileges for ${seller.email}:`, 'Policy violation or unverified activity');
    if (reason === null) return; // User cancelled

    setActionLoadingId(seller.user_id);
    try {
      await apiFetch(`/api/admin/sellers/${seller.user_id}/freeze`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      toast.success(`Selling privileges revoked for ${seller.email}`);
      await fetchDirectory();
    } catch (err: any) {
      console.error('Failed to freeze seller:', err);
      toast.error(err.message || 'Failed to freeze seller');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveSeller = async (seller: SellerItem) => {
    setActionLoadingId(seller.user_id);
    try {
      await apiFetch(`/api/admin/sellers/${seller.user_id}/approve`, {
        method: 'POST',
      });
      toast.success(`Selling privileges restored for ${seller.email}`);
      await fetchDirectory();
    } catch (err: any) {
      console.error('Failed to approve seller:', err);
      toast.error(err.message || 'Failed to restore seller privileges');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered sellers
  const filteredSellers = useMemo(() => {
    if (!data?.sellers) return [];
    return data.sellers.filter((s) => {
      // Status filter
      if (statusFilter !== 'all' && s.display_status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const orgNames = s.organizers.map((o) => o.name.toLowerCase()).join(' ');
        const matchesEmail = s.email?.toLowerCase().includes(q);
        const matchesUsername = s.username?.toLowerCase().includes(q);
        const matchesOrg = orgNames.includes(q);
        return matchesEmail || matchesUsername || matchesOrg;
      }
      return true;
    });
  }, [data, statusFilter, searchQuery]);

  if (authLoading) {
    return (
      <AdminLayout title="Seller Oversight & Moderation">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!user || !user.is_admin) {
    return (
      <AdminLayout title="Unauthorized">
        <div className="p-8 text-center text-red-600">
          <h2 className="text-xl font-bold">Unauthorized</h2>
          <p>You must be an administrator to view this page.</p>
        </div>
      </AdminLayout>
    );
  }

  const stats = data?.stats || {
    total_sellers: 0,
    active_verified: 0,
    pending_setup: 0,
    frozen_revoked: 0,
    connected_stripe: 0,
  };

  return (
    <AdminLayout title="Seller Oversight & Moderation">
      <Head>
        <title>Seller Oversight & Moderation | Admin</title>
      </Head>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>🛡️ Seller Oversight & Moderation</span>
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Live platform directory of active, auto-verified, and moderated event sellers.
            </p>
          </div>
          <button
            onClick={fetchDirectory}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-all disabled:opacity-50"
          >
            <svg className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Active / Auto-Verified</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 mt-2">{stats.active_verified}</div>
            <p className="text-xs text-emerald-700 font-medium mt-1">Can publish & sell tickets</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Connected Stripe</span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Express</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-900 mt-2">{stats.connected_stripe}</div>
            <p className="text-xs text-indigo-700 font-medium mt-1">Payout accounts linked</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Pending Setup</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 mt-2">{stats.pending_setup}</div>
            <p className="text-xs text-amber-700 font-medium mt-1">Awaiting Stripe completion</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Suspended / Frozen</span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-900 mt-2">{stats.frozen_revoked}</div>
            <p className="text-xs text-red-700 font-medium mt-1">Selling privileges revoked</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({data?.sellers?.length || 0})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'active' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active / Auto-Verified ({stats.active_verified})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'pending' ? 'bg-white text-amber-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending ({stats.pending_setup})
            </button>
            <button
              onClick={() => setStatusFilter('frozen')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'frozen' ? 'bg-white text-red-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Frozen / Revoked ({stats.frozen_revoked})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[280px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email, username, or organizer…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Sellers Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Seller Account</th>
                  <th className="py-3.5 px-4">Organizer / Brand</th>
                  <th className="py-3.5 px-4">Stripe Connect Status</th>
                  <th className="py-3.5 px-4">Platform Status</th>
                  <th className="py-3.5 px-4 text-center">Events</th>
                  <th className="py-3.5 px-4 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredSellers.map((seller) => {
                  const isActionLoading = actionLoadingId === seller.user_id;

                  return (
                    <tr key={seller.user_id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Seller Account */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-900">{seller.username || 'Unnamed Seller'}</div>
                        <div className="text-xs text-gray-500">{seller.email}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {seller.user_id.slice(0, 10)}…</div>
                      </td>

                      {/* Organizer / Brand Profiles */}
                      <td className="py-4 px-4">
                        {seller.organizers && seller.organizers.length > 0 ? (
                          <div className="space-y-1.5">
                            {seller.organizers.map((org) => (
                              <div key={org.id} className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-gray-800">{org.name}</span>
                                {org.is_verified && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    ✓ Verified
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No brand profile yet</span>
                        )}
                      </td>

                      {/* Stripe Connect Status */}
                      <td className="py-4 px-4">
                        {seller.organizers?.some((o) => o.stripe_account?.stripe_account_id) ? (
                          <div className="space-y-1">
                            {seller.organizers
                              .filter((o) => o.stripe_account?.stripe_account_id)
                              .map((o) => (
                                <div key={o.id} className="text-xs">
                                  <div className="font-mono text-[11px] text-gray-600">
                                    {o.stripe_account?.stripe_account_id}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                                      o.stripe_account?.charges_enabled ? 'text-emerald-700' : 'text-amber-700'
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        o.stripe_account?.charges_enabled ? 'bg-emerald-500' : 'bg-amber-400'
                                      }`}></span>
                                      {o.stripe_account?.charges_enabled ? 'Charges Active' : 'Charges Inactive'}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                                      o.stripe_account?.payouts_enabled ? 'text-emerald-700' : 'text-amber-700'
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        o.stripe_account?.payouts_enabled ? 'bg-emerald-500' : 'bg-amber-400'
                                      }`}></span>
                                      {o.stripe_account?.payouts_enabled ? 'Payouts Active' : 'Payouts Inactive'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 font-medium">
                            <span>⚠️</span> Not Connected
                          </span>
                        )}
                      </td>

                      {/* Platform Status Badge */}
                      <td className="py-4 px-4">
                        {seller.display_status === 'active' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Active / Auto-Verified
                          </span>
                        )}
                        {seller.display_status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            Pending Stripe Setup
                          </span>
                        )}
                        {seller.display_status === 'frozen' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Privileges Revoked / Frozen
                          </span>
                        )}
                      </td>

                      {/* Events Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                          {seller.events_count}
                        </span>
                      </td>

                      {/* Moderation Actions */}
                      <td className="py-4 px-4 text-right">
                        {seller.display_status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleFreezeSeller(seller)}
                            disabled={isActionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            <span>Freeze / Revoke Privileges</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApproveSeller(seller)}
                            disabled={isActionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            <span>Restore / Approve Privileges</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredSellers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500 text-sm">
                      No sellers matching your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
