import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, type SellerStatusResponse } from '@/lib/api';
import type { GuidedEventDraft } from './guidedEventTypes';
import { nativeTicketIssue } from './guidedFormHelpers';

const fieldClass = 'min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-stone-dark focus:border-moss-green focus:ring-2 focus:ring-moss-green/30';

interface Props {
  draft: GuidedEventDraft;
  error?: string;
  onChange: (patch: Partial<GuidedEventDraft>) => void;
  onChooseAnotherMethod: () => void;
}

export function TicketsQuestion({ draft, error, onChange, onChooseAnotherMethod }: Props) {
  const [seller, setSeller] = useState<SellerStatusResponse | null>(null);
  const [statusState, setStatusState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  useEffect(() => {
    let cancelled = false;
    setStatusState('loading');
    api.sellers.getStatus(draft.organizerId || null).then((result) => {
      if (!cancelled) { setSeller(result); setStatusState('ready'); }
    }).catch(() => { if (!cancelled) { setSeller(null); setStatusState('unavailable'); } });
    return () => { cancelled = true; };
  }, [draft.organizerId]);

  const issue = nativeTicketIssue(draft);
  const setTier = (id: string, patch: Partial<GuidedEventDraft['ticketTiers'][number]>) => onChange({ ticketTiers: draft.ticketTiers.map((tier) => tier.id === id ? { ...tier, ...patch } : tier) });
  return <div className="space-y-6">
    {issue && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950" role="alert"><strong className="block">This schedule cannot use Highland Events Hub tickets.</strong>{issue}<button type="button" className="mt-3 block font-bold underline" onClick={onChooseAnotherMethod}>Choose another attendance method</button></div>}
    <div className={`rounded-2xl border p-4 text-sm ${seller?.charges_enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`} role="status">
      <strong className="block">Seller connection: {statusState === 'loading' ? 'checking…' : statusState === 'unavailable' ? 'could not verify' : seller?.charges_enabled ? 'charges enabled' : 'not ready'}</strong>
      {seller?.charges_enabled ? 'This host can configure tickets.' : 'A Stripe-connected seller with charges enabled is required before publishing native tickets. Select the final host in Event details; this preview cannot connect Stripe or publish tickets.'}
    </div>
    <div className="space-y-4">
      <div><h2 className="text-lg font-bold text-highland-green">Ticket tiers</h2><p className="text-sm text-gray-600">Add types such as General Admission or VIP. £0 creates a free ticket.</p></div>
      {draft.ticketTiers.map((tier, index) => <fieldset key={tier.id} className="relative rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <legend className="px-1 text-sm font-bold text-highland-green">Tier {index + 1}</legend>
        <button type="button" onClick={() => onChange({ ticketTiers: draft.ticketTiers.filter((item) => item.id !== tier.id) })} className="absolute right-4 top-3 flex min-h-[44px] items-center gap-1 text-sm font-semibold text-red-700 hover:underline" aria-label={`Remove tier ${index + 1}`}><Trash2 aria-hidden="true" className="h-4 w-4" />Remove</button>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold text-gray-800">Tier name *</span><input className={fieldClass} type="text" maxLength={100} value={tier.name} onChange={(event) => setTier(tier.id, { name: event.target.value })} placeholder="e.g. General Admission" /></label>
          <label className="space-y-2"><span className="text-sm font-semibold text-gray-800">Price (£) *</span><input className={fieldClass} type="number" min="0" step="0.01" value={Number.isNaN(tier.price) ? '' : tier.price} onChange={(event) => setTier(tier.id, { price: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
          <label className="space-y-2"><span className="text-sm font-semibold text-gray-800">Quantity available *</span><input className={fieldClass} type="number" min="1" step="1" value={Number.isNaN(tier.quantity_available) ? '' : tier.quantity_available} onChange={(event) => setTier(tier.id, { quantity_available: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
          <label className="space-y-2"><span className="text-sm font-semibold text-gray-800">Maximum per order *</span><input className={fieldClass} type="number" min="1" step="1" value={Number.isNaN(tier.max_per_order) ? '' : tier.max_per_order} onChange={(event) => setTier(tier.id, { max_per_order: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
        </div>
      </fieldset>)}
      <button type="button" onClick={() => onChange({ ticketTiers: [...draft.ticketTiers, { id: crypto.randomUUID(), name: '', price: 0, quantity_available: 50, max_per_order: 10 }] })} className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100"><Plus aria-hidden="true" className="h-4 w-4" />Add ticket tier</button>
    </div>
    <label className="flex min-h-[48px] items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm text-gray-800"><input type="checkbox" checked={draft.passFeesToBuyer} onChange={(event) => onChange({ passFeesToBuyer: event.target.checked })} className="mt-0.5 h-5 w-5 accent-emerald-700" /><span><strong className="block">Pass booking fees to the buyer</strong><span className="mt-1 block text-gray-600">When off, fees are absorbed into the ticket price. Final fee calculations happen only in live checkout.</span></span></label>
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
