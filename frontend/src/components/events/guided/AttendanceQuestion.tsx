import type { AttendanceMode, GuidedEventDraft } from './guidedEventTypes';
import { nativeTicketIssue } from './guidedFormHelpers';

const choices: Array<{ id: AttendanceMode; title: string; description: string }> = [
  { id: 'free', title: 'Free entry', description: 'Just turn up. No booking needed.' },
  { id: 'door', title: 'Pay at the door', description: 'Visitors pay when they arrive.' },
  { id: 'external', title: 'Book or buy tickets elsewhere', description: 'Send visitors to your external booking page.' },
  { id: 'native', title: 'Get tickets on Highland Events Hub', description: 'Configure ticket tiers for this one-off event.' },
];

const fieldClass = 'min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-stone-dark focus:border-moss-green focus:ring-2 focus:ring-moss-green/30';

interface Props {
  draft: GuidedEventDraft;
  error?: string;
  onChange: (patch: Partial<GuidedEventDraft>) => void;
}

export function AttendanceQuestion({ draft, error, onChange }: Props) {
  const nativeIssue = nativeTicketIssue(draft);
  return <div className="space-y-6">
    <fieldset>
      <legend className="sr-only">How can people attend?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => <label key={choice.id} className={`flex min-h-[104px] cursor-pointer gap-3 rounded-2xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-moss-green/50 ${draft.attendanceMode === choice.id ? 'border-moss-green bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}>
          <input type="radio" name="guided-attendance" value={choice.id} checked={draft.attendanceMode === choice.id} onChange={() => onChange({ attendanceMode: choice.id })} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" />
          <span><strong className="block text-sm text-highland-green">{choice.title}</strong><span className="mt-1 block text-sm leading-5 text-gray-600">{choice.description}</span></span>
        </label>)}
      </div>
    </fieldset>

    {draft.attendanceMode === 'door' && <div className="space-y-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
      <label className="block space-y-2 text-sm font-semibold text-gray-800"><span>Admission price at the door (£) *</span><input id="guided-door-price" className={fieldClass} type="number" min="0.01" step="0.01" value={draft.doorPrice} onChange={(event) => onChange({ doorPrice: event.target.value })} /></label>
      <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium text-gray-800"><input type="checkbox" checked={draft.doorReservationRequired} onChange={(event) => onChange({ doorReservationRequired: event.target.checked })} className="h-5 w-5 accent-emerald-700" />Advance reservation is required</label>
      {draft.doorReservationRequired && <label className="block space-y-2 text-sm font-semibold text-gray-800"><span>Reservation URL *</span><input id="guided-door-reservation" className={fieldClass} type="url" inputMode="url" placeholder="https://example.com/reserve" value={draft.doorReservationUrl} onChange={(event) => onChange({ doorReservationUrl: event.target.value })} /></label>}
      <p className="text-sm text-gray-600">Payment happens at the door. The reservation link, if needed, is only for booking ahead.</p>
    </div>}

    {draft.attendanceMode === 'external' && <div className="space-y-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
      <label className="block space-y-2 text-sm font-semibold text-gray-800"><span>Booking or ticket URL *</span><input id="guided-external-url" className={fieldClass} type="url" inputMode="url" placeholder="https://example.com/book" value={draft.externalUrl} onChange={(event) => onChange({ externalUrl: event.target.value })} /></label>
      <fieldset><legend className="mb-2 text-sm font-semibold text-gray-800">Is external booking free or paid? *</legend><div className="flex flex-wrap gap-4">{[{ value: true, label: 'Free' }, { value: false, label: 'Paid' }].map((choice) => <label key={choice.label} className="flex min-h-[44px] items-center gap-2 text-sm text-gray-800"><input type="radio" name="guided-external-price" checked={draft.externalIsFree === choice.value} onChange={() => onChange({ externalIsFree: choice.value })} className="h-4 w-4 accent-emerald-700" />{choice.label}</label>)}</div></fieldset>
    </div>}

    {draft.attendanceMode === 'native' && nativeIssue && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950" role="status">
      <strong className="block">Native tickets are not available for this schedule</strong>
      {nativeIssue} Choose Free entry, Pay at the door or Book elsewhere above, or go Back to change the schedule. Your ticket answers are kept if you switch back.
    </div>}
    {draft.attendanceMode === 'native' && !nativeIssue && <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-gray-700">Next you can add ticket tiers. Stripe connection is required before a live ticketed event can be published; this preview will not start onboarding or take payments.</p>}
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
