import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, type SellerStatusResponse } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import OrganizerSelector from '@/components/events/OrganizerSelector';
import type { Organizer } from '@/types';
import type { GuidedEventDraft } from './guidedEventTypes';
import { nativeTicketIssue } from './guidedFormHelpers';

const fieldClass = 'min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-stone-dark focus:border-moss-green focus:ring-2 focus:ring-moss-green/30';

interface Props {
  draft: GuidedEventDraft;
  error?: string;
  onChange: (patch: Partial<GuidedEventDraft>) => void;
  onChooseAnotherMethod: () => void;
  onSellerReadyChange: (ready: boolean) => void;
}

export function TicketsQuestion({ draft, error, onChange, onChooseAnotherMethod, onSellerReadyChange }: Props) {
  const { user } = useAuth();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [seller, setSeller] = useState<SellerStatusResponse | null>(null);
  const [statusState, setStatusState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const statusRequestRef = useRef(0);
  const organizerId = draft.organizerId;
  const hostName = draft.organizerName || user?.username || 'your personal profile';

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    api.organizers.list({ user_id: user.id }).then((result) => {
      if (!cancelled) setOrganizers(result.organizers || []);
    }).catch(() => { if (!cancelled) setOrganizers([]); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const checkStatus = useCallback(async () => {
    const requestId = ++statusRequestRef.current;
    setStatusState('loading');
    try {
      const result = await api.sellers.getStatus(organizerId || null);
      if (requestId !== statusRequestRef.current) return;
      setSeller(result);
      setStatusState('ready');
      onSellerReadyChange(Boolean(result.charges_enabled));
      if (result.charges_enabled) setConnecting(false);
    } catch {
      if (requestId !== statusRequestRef.current) return;
      setSeller(null);
      setStatusState('unavailable');
      onSellerReadyChange(false);
    }
  }, [organizerId, onSellerReadyChange]);

  useEffect(() => () => { statusRequestRef.current += 1; }, []);

  useEffect(() => {
    setSeller(null);
    setStatusState('loading');
    onSellerReadyChange(false);
    void checkStatus();
  }, [checkStatus, onSellerReadyChange]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void checkStatus(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [checkStatus]);

  useEffect(() => {
    if (!connecting || seller?.charges_enabled) return;
    const interval = window.setInterval(() => void checkStatus(), 4000);
    return () => window.clearInterval(interval);
  }, [connecting, seller?.charges_enabled, checkStatus]);

  useEffect(() => {
    if (seller?.charges_enabled && draft.ticketTiers.length === 0) {
      onChange({ ticketTiers: [{ id: crypto.randomUUID(), name: 'General Admission', price: 0, quantity_available: 100, max_per_order: 10 }] });
    }
  }, [seller?.charges_enabled, draft.ticketTiers.length, onChange]);

  const handleConnectStripe = async () => {
    setConnecting(true);
    setConnectionError(null);
    try {
      const response = await api.sellers.onboard(organizerId || null, window.location.href);
      if (!response.url) throw new Error('Could not generate a Stripe onboarding link.');
      window.open(response.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to initiate Stripe onboarding.');
      setConnecting(false);
    }
  };

  const issue = nativeTicketIssue(draft);
  const setTier = (id: string, patch: Partial<GuidedEventDraft['ticketTiers'][number]>) => onChange({ ticketTiers: draft.ticketTiers.map((tier) => tier.id === id ? { ...tier, ...patch } : tier) });
  return <div className="space-y-6">
    {issue && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950" role="alert"><strong className="block">This schedule cannot use Highland Events Hub tickets.</strong>{issue}<button type="button" className="mt-3 block font-bold underline" onClick={onChooseAnotherMethod}>Choose another attendance method</button></div>}
    {user && <div className="rounded-2xl border border-gray-200 p-4"><p className="mb-3 text-sm font-semibold text-highland-green">Who will sell these tickets?</p><OrganizerSelector user={user} organizers={organizers} selectedId={draft.organizerId} onChange={(organizerId) => onChange({ organizerId, organizerName: organizers.find((organizer) => organizer.id === organizerId)?.name || user.username || user.email || 'Personal profile' })} /></div>}
    {!user && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Sign in to connect Stripe payouts and create a ticketed event.</p>}
    <div className={`rounded-2xl border p-4 text-sm ${seller?.charges_enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`} role="status">
      <strong className="block">Seller connection: {statusState === 'loading' ? 'checking…' : statusState === 'unavailable' ? 'could not verify' : seller?.charges_enabled ? 'charges enabled' : 'not ready'}</strong>
      {statusState === 'loading' ? `Checking payouts for ${hostName}.` : seller?.charges_enabled ? `${hostName} can configure tickets.` : `Connect Stripe payouts for ${hostName} before publishing. The host can be changed in Event details.`}
    </div>
    {!issue && statusState !== 'loading' && !seller?.charges_enabled && <div className="flex flex-wrap gap-3">
      <button type="button" onClick={handleConnectStripe} disabled={connecting || !user} className="min-h-[44px] rounded-xl bg-moss-green px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{connecting ? 'Connecting with Stripe…' : 'Connect Stripe Payouts'}</button>
      <button type="button" onClick={() => void checkStatus()} className="min-h-[44px] rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-highland-green">Refresh status</button>
      {connecting && <p role="status" className="w-full text-sm text-amber-900">Complete onboarding in the new tab, then return here. Seller status will refresh automatically.</p>}
      {connectionError && <p role="alert" className="w-full text-sm text-red-700">{connectionError}</p>}
    </div>}
    {!issue && seller?.charges_enabled && <div className="space-y-4">
      <div><h2 className="text-lg font-bold text-highland-green">Ticket tiers</h2><p className="text-sm text-gray-600">Add types such as General Admission or VIP. £0 creates a free ticket.</p></div>
      {draft.ticketTiers.map((tier, index) => <fieldset key={tier.id} className="relative rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <legend className="px-1 text-sm font-bold text-highland-green">Tier {index + 1}</legend>
        {draft.ticketTiers.length > 1 && <button type="button" onClick={() => onChange({ ticketTiers: draft.ticketTiers.filter((item) => item.id !== tier.id) })} className="absolute right-4 top-3 flex min-h-[44px] items-center gap-1 text-sm font-semibold text-red-700 hover:underline" aria-label={`Remove tier ${index + 1}`}><Trash2 aria-hidden="true" className="h-4 w-4" />Remove</button>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold text-gray-800">Tier name *</span><input className={fieldClass} type="text" maxLength={100} value={tier.name} onChange={(event) => setTier(tier.id, { name: event.target.value })} placeholder="e.g. General Admission" /></label>
          <label className="space-y-2"><span className="text-sm font-semibold text-gray-800">Price (£) *</span><input className={fieldClass} type="number" min="0" step="0.01" value={Number.isNaN(tier.price) ? '' : tier.price} onChange={(event) => setTier(tier.id, { price: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
          <label className="space-y-2"><span className="text-sm font-semibold text-gray-800">Quantity available *</span><input className={fieldClass} type="number" min="1" step="1" value={Number.isNaN(tier.quantity_available) ? '' : tier.quantity_available} onChange={(event) => setTier(tier.id, { quantity_available: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
          <label className="space-y-2"><span className="text-sm font-semibold text-gray-800">Maximum per order *</span><input className={fieldClass} type="number" min="1" step="1" value={Number.isNaN(tier.max_per_order) ? '' : tier.max_per_order} onChange={(event) => setTier(tier.id, { max_per_order: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
        </div>
      </fieldset>)}
      <button type="button" onClick={() => onChange({ ticketTiers: [...draft.ticketTiers, { id: crypto.randomUUID(), name: '', price: 0, quantity_available: 50, max_per_order: 10 }] })} className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100"><Plus aria-hidden="true" className="h-4 w-4" />Add ticket tier</button>
    </div>}
    {!issue && seller?.charges_enabled && <label className="flex min-h-[48px] items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm text-gray-800"><input type="checkbox" checked={draft.passFeesToBuyer} onChange={(event) => onChange({ passFeesToBuyer: event.target.checked })} className="mt-0.5 h-5 w-5 accent-emerald-700" /><span><strong className="block">Pass booking fees to the buyer</strong><span className="mt-1 block text-gray-600">When off, fees are absorbed into the ticket price. Final fee calculations happen only in live checkout.</span></span></label>}
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
