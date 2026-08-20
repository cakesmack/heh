import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useEventWizard';
import { Organizer } from '@/types';
import { api, SellerStatusResponse } from '@/lib/api';
import { Spinner } from '@/components/common/Spinner';
import { toast } from 'react-hot-toast';

interface StepTicketsProps {
  form: UseFormReturn<WizardFormData>;
  user?: any;
  organizers?: Organizer[];
  stepErrors: Record<string, string> | null;
}

export default function StepTickets({
  form,
  user,
  organizers = [],
  stepErrors,
}: StepTicketsProps) {
  const { control, register, watch, setValue } = form;
  const errors = stepErrors || {};

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'ticket_tiers',
  });

  const watchedTiers = watch('ticket_tiers') || [];
  const passFeesToBuyer = watch('pass_fees_to_buyer');

  // Selected host entity
  const selectedOrganizerId = watch('selectedOrganizer') ?? watch('organizer_profile_id') ?? '';
  const selectedHostOrg = organizers.find((o) => o.id === selectedOrganizerId);
  const hostDisplayName = selectedHostOrg
    ? selectedHostOrg.name
    : (user?.display_name || user?.username || user?.email?.split('@')[0] || 'Personal Profile');

  // Seller & Stripe Connect state
  const [sellerStatus, setSellerStatus] = useState<SellerStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch status from backend for currently selected host entity
  const checkStatus = useCallback(async (showToast = false) => {
    setIsLoadingStatus(true);
    try {
      const res = await api.sellers.getStatus(selectedOrganizerId || null);
      setSellerStatus(res);
      if (showToast) {
        if (res.charges_enabled) {
          toast.success(`Stripe payouts are active for ${hostDisplayName}!`);
        } else {
          toast.error(`Stripe account for ${hostDisplayName} is not yet fully activated.`);
        }
      }
      if (res.charges_enabled && isConnecting) {
        setIsConnecting(false);
      }
    } catch (err: any) {
      console.error('Failed to get seller status in StepTickets:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [selectedOrganizerId, hostDisplayName, isConnecting]);

  // Initial fetch and on host change
  useEffect(() => {
    checkStatus();
  }, [selectedOrganizerId]);

  // Live status refresh when returning to window/tab
  useEffect(() => {
    const handleFocus = () => {
      checkStatus();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkStatus]);

  // Poll while connecting
  useEffect(() => {
    if (isConnecting && !sellerStatus?.charges_enabled) {
      pollIntervalRef.current = setInterval(() => {
        checkStatus();
      }, 4000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isConnecting, sellerStatus?.charges_enabled, checkStatus]);

  // Handle Stripe Connect onboarding link trigger
  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      const returnUrl = typeof window !== 'undefined' ? window.location.href : undefined;
      const response = await api.sellers.onboard(selectedOrganizerId || null, returnUrl);
      if (response.url) {
        // Open onboarding in new tab to preserve event typed progress in current tab
        window.open(response.url, '_blank', 'noopener,noreferrer');
        toast.success('Stripe onboarding opened in a new tab. Complete setup and return here!');
      } else {
        toast.error('Could not generate Stripe onboarding link.');
        setIsConnecting(false);
      }
    } catch (err: any) {
      console.error('Stripe connect error:', err);
      toast.error(err.message || 'Failed to initiate Stripe onboarding.');
      setIsConnecting(false);
    }
  };

  // Ensure there's at least one tier if charges are enabled
  useEffect(() => {
    if (sellerStatus?.charges_enabled && fields.length === 0) {
      append({ name: 'General Admission', price: 0, quantity_available: 100, max_per_order: 10 });
    }
  }, [sellerStatus?.charges_enabled, fields.length, append]);

  // Calculate dynamic helper text based on entered tier price
  const firstPaidTier = watchedTiers.find((t) => Number(t.price) > 0);
  const samplePrice = firstPaidTier ? Number(firstPaidTier.price) : 20.00;
  const estimatedFee = Number((samplePrice * 0.035 + 0.30).toFixed(2));
  const buyerPriceWithFee = Number((samplePrice + estimatedFee).toFixed(2));
  const organizerPriceAbsorbed = Math.max(0, Number((samplePrice - estimatedFee).toFixed(2)));

  const isStripeActive = Boolean(sellerStatus?.charges_enabled);

  return (
    <div className="space-y-8">
      {/* ─── Host Entity Context Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Native Ticketing Setup</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Hosting as: <span className="font-semibold text-gray-800">{hostDisplayName}</span>
          </p>
        </div>

        {isStripeActive ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 text-xs font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Stripe Payouts Active</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200 text-xs font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Action Required: Connect Stripe</span>
          </div>
        )}
      </div>

      {/* ─── Condition 1: Loading State ─── */}
      {isLoadingStatus && !sellerStatus && (
        <div className="p-12 text-center bg-gray-50 rounded-2xl border border-gray-200">
          <Spinner size="md" className="mx-auto mb-3 text-emerald-600" />
          <p className="text-sm font-medium text-gray-700">Verifying payout configuration for {hostDisplayName}...</p>
        </div>
      )}

      {/* ─── Condition 2: Stripe Not Connected / Action Required Banner ─── */}
      {!isLoadingStatus && !isStripeActive && (
        <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50/60 border-2 border-amber-300/90 rounded-2xl shadow-sm text-amber-950 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 text-2xl shadow-xs">
              🏦
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Connect Stripe Payouts to Sell Tickets
              </h4>
              <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">
                To sell tickets as <strong>{hostDisplayName}</strong>, you need to connect your payout bank account via Stripe.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Ticket payouts and customer payments are routed securely to your connected Stripe account. Highland Events Hub does not hold your funds.
              </p>
            </div>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConnectStripe}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  <span>Connecting with Stripe...</span>
                </>
              ) : (
                <>
                  <span>Connect Stripe Payouts</span>
                  <span className="text-emerald-200 font-normal">→</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => checkStatus(true)}
              disabled={isLoadingStatus}
              className="inline-flex items-center gap-1.5 px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-200 shadow-xs transition-colors text-sm cursor-pointer"
            >
              <svg className={`w-4 h-4 text-gray-500 ${isLoadingStatus ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isLoadingStatus ? 'Checking...' : 'Refresh Status'}</span>
            </button>
          </div>

          {isConnecting && (
            <div className="p-3.5 bg-white/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2 shadow-xs">
              <span className="animate-pulse">⏳</span>
              <span>
                A new tab was opened for Stripe onboarding. Complete the steps in Stripe, then return here — this page will automatically unlock your ticket tiers.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Condition 3: Active Seller -> Render Ticket Tier Builder Grid ─── */}
      {isStripeActive && (
        <>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ticket Tiers</h3>
                <p className="text-sm text-gray-500">
                  Create the ticket types you want to sell. You can add multiple tiers (e.g., General Admission, VIP).
                </p>
              </div>
            </div>
            
            {errors.ticket_tiers && typeof errors.ticket_tiers === 'string' && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {errors.ticket_tiers}
              </div>
            )}

            <div className="space-y-4">
              {fields.map((field, index) => {
                const fieldErrors = {
                  name: errors[`ticket_tiers.${index}.name`],
                  price: errors[`ticket_tiers.${index}.price`],
                  quantity_available: errors[`ticket_tiers.${index}.quantity_available`],
                  max_per_order: errors[`ticket_tiers.${index}.max_per_order`],
                };

                return (
                  <div key={field.id} className="p-5 border border-gray-200 rounded-2xl bg-gray-50 relative group">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 p-1 transition-colors"
                        title="Remove Tier"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mr-8">
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tier Name *</label>
                        <input
                          type="text"
                          {...register(`ticket_tiers.${index}.name` as const)}
                          placeholder="e.g. General Admission, VIP"
                          className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            fieldErrors.name ? 'border-red-500' : 'border-gray-200'
                          }`}
                        />
                        {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Price (£) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          {...register(`ticket_tiers.${index}.price` as const, { valueAsNumber: true })}
                          className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            fieldErrors.price ? 'border-red-500' : 'border-gray-200'
                          }`}
                        />
                        <p className="mt-1 text-xs text-gray-500">Set to 0 for free tickets.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity Available *</label>
                        <input
                          type="number"
                          min="1"
                          {...register(`ticket_tiers.${index}.quantity_available` as const, { valueAsNumber: true })}
                          className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            fieldErrors.quantity_available ? 'border-red-500' : 'border-gray-200'
                          }`}
                        />
                        {fieldErrors.quantity_available && <p className="mt-1 text-xs text-red-500">{fieldErrors.quantity_available}</p>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Max per Order *</label>
                        <input
                          type="number"
                          min="1"
                          {...register(`ticket_tiers.${index}.max_per_order` as const, { valueAsNumber: true })}
                          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => append({ name: '', price: 0, quantity_available: 50, max_per_order: 10 })}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Ticket Tier
            </button>
          </div>

          {/* ─── Per-Event Fee Pass-Through Toggle ────────────────────── */}
          <div className="p-5 border border-emerald-100 bg-emerald-50/40 rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label htmlFor="pass_fees_toggle" className="text-sm font-bold text-gray-900 cursor-pointer">
                  Pass booking fees to the buyer
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  Choose whether ticket buyers pay the booking fee on top, or if platform fees are absorbed into your ticket price.
                </p>

                {/* Dynamic Real-Time Helper Text */}
                <div className="mt-3 inline-block px-3.5 py-2 bg-white rounded-lg border border-emerald-200/80 shadow-xs text-xs">
                  {passFeesToBuyer ? (
                    <span className="text-emerald-800 font-medium">
                      ✨ <strong>Buyer pays £{buyerPriceWithFee.toFixed(2)}</strong> (£{samplePrice.toFixed(2)} + £{estimatedFee.toFixed(2)} booking fee). You receive exactly <strong>£{samplePrice.toFixed(2)}</strong>.
                    </span>
                  ) : (
                    <span className="text-gray-700 font-medium">
                      🏷️ <strong>Buyer pays £{samplePrice.toFixed(2)}</strong>. You receive <strong>£{organizerPriceAbsorbed.toFixed(2)}</strong> (after £{estimatedFee.toFixed(2)} platform fee).
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-1">
                <button
                  id="pass_fees_toggle"
                  type="button"
                  role="switch"
                  aria-checked={Boolean(passFeesToBuyer)}
                  onClick={() => setValue('pass_fees_to_buyer', !passFeesToBuyer, { shouldDirty: true })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                    passFeesToBuyer ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      passFeesToBuyer ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
