import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminHealthStrip from '@/components/admin/AdminHealthStrip';
import { adminAPI, analyticsAPI } from '@/lib/api';
import { AdminAnalyticsSummary, AdminDashboardStats, MissedOpportunitiesResponse } from '@/types';
import Link from 'next/link';
import {
  LivePulseWidget,
  ConversionFunnelWidget,
  MissedOpportunitiesWidget,
  TopContentWidget,
  StatCard
} from '@/components/admin/AnalyticsWidgets';
import RisingLocationsWidget from '@/components/admin/dashboard/RisingLocationsWidget';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsSummary | null>(null);
  const [missedOpportunities, setMissedOpportunities] = useState<MissedOpportunitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsData, analyticsData, missedData] = await Promise.all([
          adminAPI.getStats(),
          analyticsAPI.getAdminSummary(30),
          analyticsAPI.getMissedOpportunities(30)
        ]);
        setStats(statsData);
        setAnalytics(analyticsData);
        setMissedOpportunities(missedData);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const calculateGrowth = (current: number, previous?: number) => {
    if (!previous || previous === 0) return { value: 0, isPositive: true };
    const diff = ((current - previous) / previous) * 100;
    return {
      value: Math.round(Math.abs(diff)),
      isPositive: diff >= 0
    };
  };

  return (
    <AdminGuard>
      <AdminLayout title="Dashboard">
        <div className="max-w-7xl mx-auto space-y-8">
          {error && (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100 animate-shake">
              {error}
            </div>
          )}

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Platform Overview</h1>
              <p className="text-gray-500 mt-1 text-sm">Real-time health and performance metrics.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                System Healthy
              </span>
              <button
                onClick={() => window.location.reload()}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-xl border border-gray-100 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bento Grid Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              // Skeleton Loading
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-gray-100 shadow-sm" />
              ))
            ) : analytics && (
              <>
                {/* Main Stats */}
                <StatCard
                  title="Total Traffic"
                  value={analytics.total_views.toLocaleString()}
                  subtitle="Last 30 Days"
                  trend={calculateGrowth(analytics.total_views, analytics.previous_total_views)}
                />

                <StatCard
                  title="Unique Visitors"
                  value={analytics.total_unique_visitors.toLocaleString()}
                  subtitle="Estimated Sessions"
                />

                <LivePulseWidget analytics={analytics} />

                <ConversionFunnelWidget analytics={analytics} />

                {/* Second Row */}
                <div className="lg:col-span-2">
                  <RisingLocationsWidget />
                </div>

                <div className="lg:col-span-2">
                  {missedOpportunities && <MissedOpportunitiesWidget missed={missedOpportunities} />}
                </div>
              </>
            )}
          </div>

          {/* Platform Health Strip */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Platform Health
            </h2>
            <AdminHealthStrip
              stats={stats ? {
                total_users: stats.total_users,
                total_events: stats.total_events,
                pending_events: stats.pending_events,
                total_venues: stats.total_venues,
                total_organizers: stats.total_organizers,
                pending_reports: stats.pending_reports,
              } : null}
              loading={loading}
            />
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Add Event', href: '/admin/events', color: 'bg-emerald-500', icon: 'M12 4v16m8-8H4' },
              { label: 'Add Venue', href: '/admin/venues', color: 'bg-blue-500', icon: 'M12 4v16m8-8H4' },
              { label: 'Manage Users', href: '/admin/users', color: 'bg-indigo-500', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
              { label: 'Moderation', href: '/admin/moderation', color: 'bg-rose-500', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
              { label: 'Venue Claims', href: '/admin/claims', color: 'bg-purple-500', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { label: 'Manage Hero', href: '/admin/hero', color: 'bg-pink-500', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { label: 'Categories', href: '/admin/categories', color: 'bg-amber-500', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <button className="w-full group p-4 bg-white hover:bg-gray-50 rounded-2xl border border-gray-100 shadow-sm transition-all duration-200 flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${action.color} text-white shadow-lg shadow-${action.color.split('-')[1]}-100 group-hover:scale-110 transition-transform`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-700">{action.label}</span>
                </button>
              </Link>
            ))}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
