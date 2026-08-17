import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { AuthGuard } from '@/components/common/AuthGuard';
import { Spinner } from '@/components/common/Spinner';

interface StripeAccountInfo {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

interface OrganizerOption {
  id: string;
  name: string;
  slug: string;
  stripe_account?: StripeAccountInfo | null;
}

interface SellerStatusResponse {
  seller_tier: number;
  seller_status: string;
  organizer_id?: string | null;
  organizer_name?: string | null;
  stripe_account?: StripeAccountInfo | null;
  organizers?: OrganizerOption[];
}

export default function PayoutsPage() {
  return (
    <AuthGuard>
      <PayoutsContent />
    </AuthGuard>
  );
}

function PayoutsContent() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [statusData, setStatusData] = useState<SellerStatusResponse | null>(null);
  const [selectedOrganizerId, setSelectedOrganizerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const data = await apiFetch<SellerStatusResponse>('/api/sellers/status');
      setStatusData(data);
      if (data.organizer_id && !selectedOrganizerId) {
        setSelectedOrganizerId(data.organizer_id);
      } else if (data.organizers && data.organizers.length > 0 && !selectedOrganizerId) {
        setSelectedOrganizerId(data.organizers[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load seller status:', err);
      setError(err.message || 'Failed to load payout settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchStatus();
    }
  }, [isAuthenticated, authLoading]);

  // Handle Stripe Onboarding Redirection
  const handleConnectStripe = async () => {
    setOnboardingLoading(true);
    setError(null);
    try {
      const payload = selectedOrganizerId ? { organizer_id: selectedOrganizerId } : {};
      const res = await apiFetch<{ url: string }>(
        `/api/sellers/stripe-connect/onboard${selectedOrganizerId ? `?organizer_id=${encodeURIComponent(selectedOrganizerId)}` : ''}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error('No redirect URL returned by server.');
      }
    } catch (err: any) {
      console.error('Stripe onboarding error:', err);
      setError(err.message || 'Failed to start Stripe onboarding. Please try again.');
      setOnboardingLoading(false);
    }
  };

  // Handle Open Stripe Dashboard
  const handleOpenStripeDashboard = async () => {
    setDashboardLoading(true);
    try {
      const res = await apiFetch<{ url: string }>(
        `/api/sellers/stripe-connect/dashboard-link${selectedOrganizerId ? `?organizer_id=${encodeURIComponent(selectedOrganizerId)}` : ''}`
      );
      if (res?.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } else {
        window.open('https://dashboard.stripe.com/', '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      console.warn('Dashboard link fetch error:', err);
      window.open('https://dashboard.stripe.com/', '_blank', 'noopener,noreferrer');
    } finally {
      setDashboardLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col items-center justify-center p-6">
        <Spinner size="lg" />
        <p className="text-stone-400 mt-4 font-medium text-sm">Loading payout settings...</p>
      </div>
    );
  }

  // Selected organizer's stripe status
  const currentOrg = statusData?.organizers?.find((o) => o.id === selectedOrganizerId);
  const stripeAccount = currentOrg?.stripe_account || statusData?.stripe_account;
  const isFullyConnected = Boolean(stripeAccount?.charges_enabled && stripeAccount?.payouts_enabled);
  const isPendingAction = Boolean(stripeAccount && (!stripeAccount.charges_enabled || !stripeAccount.payouts_enabled));

  return (
    <div className="min-h-screen bg-[#121212] text-stone-100 py-10 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Financials & Payouts | Highland Events Hub</title>
        <meta name="description" content="Manage your organizer Stripe payouts and ticket revenue banking." />
      </Head>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/account"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Account
          </Link>

          <button
            onClick={() => {
              setLoading(true);
              fetchStatus();
            }}
            className="text-xs text-stone-400 hover:text-stone-200 border border-stone-700 hover:border-stone-500 px-3 py-1.5 rounded-lg transition"
          >
            Refresh Status
          </button>
        </div>

        {/* Page Header */}
        <div className="border-b border-stone-800 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Financials & Payouts</h1>
              <p className="text-stone-400 mt-1 text-sm">
                Direct bank payouts and revenue management powered securely by Stripe Connect.
              </p>
            </div>

            {/* Status Badge */}
            <div>
              {isFullyConnected ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Ready to Accept Payments
                </div>
              ) : isPendingAction ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Action Required on Stripe
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-stone-800 border border-stone-700 text-stone-400">
                  <span className="w-2 h-2 rounded-full bg-stone-500"></span>
                  Not Connected
                </div>
              )}
            </div>
          </div>

          {/* Organizer Profile Selector (if user has multiple) */}
          {statusData?.organizers && statusData.organizers.length > 1 && (
            <div className="mt-4 flex items-center gap-3">
              <label htmlFor="organizer-select" className="text-xs text-stone-400 font-medium">
                Organizer Profile:
              </label>
              <select
                id="organizer-select"
                value={selectedOrganizerId}
                onChange={(e) => setSelectedOrganizerId(e.target.value)}
                className="bg-stone-800 border border-stone-700 text-stone-200 text-xs rounded-lg px-3 py-1.5 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {statusData.organizers.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.stripe_account?.charges_enabled ? '✓ (Connected)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-300 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-red-200">Connection Error</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Main Status Panel */}
        {isFullyConnected ? (
          /* ─── State 1: Connected & Verified ─── */
          <div className="bg-stone-900/90 border border-emerald-500/20 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Stripe Account Connected</h2>
                  <p className="text-stone-400 text-xs mt-0.5 font-mono">
                    Account ID: {stripeAccount?.stripe_account_id}
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenStripeDashboard}
                disabled={dashboardLoading}
                className="inline-flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl border border-stone-700 transition shadow-sm"
              >
                {dashboardLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <span>View Stripe Dashboard</span>
                    <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-800">
              <div className="bg-stone-950/60 p-4 rounded-xl border border-stone-800/80">
                <p className="text-xs text-stone-400">Card Charges</p>
                <p className="text-emerald-400 font-bold text-base mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Active
                </p>
                <p className="text-[11px] text-stone-500 mt-1">Accept Visa, Mastercard, Apple Pay, Google Pay</p>
              </div>

              <div className="bg-stone-950/60 p-4 rounded-xl border border-stone-800/80">
                <p className="text-xs text-stone-400">Direct Bank Payouts</p>
                <p className="text-emerald-400 font-bold text-base mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Enabled
                </p>
                <p className="text-[11px] text-stone-500 mt-1">Automatic rolling 2-day bank transfers</p>
              </div>

              <div className="bg-stone-950/60 p-4 rounded-xl border border-stone-800/80">
                <p className="text-xs text-stone-400">Platform Security</p>
                <p className="text-white font-bold text-base mt-1 flex items-center gap-1.5">
                  🔒 PCI Level 1
                </p>
                <p className="text-[11px] text-stone-500 mt-1">Banking data encrypted & handled by Stripe</p>
              </div>
            </div>
          </div>
        ) : isPendingAction ? (
          /* ─── State 2: Action Required / Partial Onboarding ─── */
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">Stripe Setup Incomplete</h2>
                <p className="text-stone-300 text-sm">
                  Stripe needs additional verification information (e.g. photo ID or bank details) before ticket sales can be deposited into your account.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleConnectStripe}
                disabled={onboardingLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {onboardingLoading ? <Spinner size="sm" /> : 'Complete Stripe Verification'}
              </button>
            </div>
          </div>
        ) : (
          /* ─── State 3: Not Connected (Initial Onboarding) ─── */
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 sm:p-10 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-extrabold text-white">
                Get Paid for Ticket Sales Automatically
              </h2>
              <p className="text-stone-300 text-sm leading-relaxed">
                Connect your UK or international bank account via <span className="text-white font-semibold">Stripe</span> to enable native ticket sales on Highland Events Hub. Ticket buyers pay directly, and your earnings are deposited straight into your bank account.
              </p>
            </div>

            {/* Value Props */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-stone-950/70 p-5 rounded-xl border border-stone-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-white text-sm">Direct Bank Payouts</h3>
                <p className="text-stone-400 text-xs leading-normal">
                  Ticket revenue lands directly in your bank account on a rolling 2-day payout schedule.
                </p>
              </div>

              <div className="bg-stone-950/70 p-5 rounded-xl border border-stone-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-bold text-white text-sm">Zero Bank Details Stored</h3>
                <p className="text-stone-400 text-xs leading-normal">
                  We never view or store your banking credentials. All verification is handled directly by Stripe.
                </p>
              </div>

              <div className="bg-stone-950/70 p-5 rounded-xl border border-stone-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <h3 className="font-bold text-white text-sm">Instant Ticket Activations</h3>
                <p className="text-stone-400 text-xs leading-normal">
                  Once connected, native ticketing activates instantly on all of your published Highland events.
                </p>
              </div>
            </div>

            {/* Onboard CTA */}
            <div className="pt-4 border-t border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-xs text-stone-400">
                Takes less than 2 minutes to complete on Stripe’s hosted verification page.
              </div>

              <button
                onClick={handleConnectStripe}
                disabled={onboardingLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold px-8 py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {onboardingLoading ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span>Connecting to Stripe...</span>
                  </div>
                ) : (
                  <>
                    <span>Connect Stripe Account</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Informational Footer / FAQ */}
        <div className="bg-stone-900/50 border border-stone-800/80 rounded-xl p-6 text-xs text-stone-400 space-y-2">
          <p className="font-semibold text-stone-300">How do platform fees and payouts work?</p>
          <p>
            When a customer buys a ticket, payment processing is handled through your connected Stripe account. Highland Events Hub charges a small standard platform fee per ticket to maintain hosting, calendar listings, and QR scan infrastructure. Your net proceeds are released directly to your nominated bank account by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
