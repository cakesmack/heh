import RichText from '@/components/ui/RichText';
import type { GuidedEventDraft, GuidedQuestionId } from './guidedEventTypes';
import { attendanceSummary, isHttpUrl, nativeTicketIssue } from './guidedFormHelpers';
import { formatLocalDateTime, scheduleSummary } from './scheduleHelpers';

function ReviewSection({ title, question, onEdit, children }: { title: string; question: GuidedQuestionId; onEdit: (question: GuidedQuestionId) => void; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-highland-green">{title}</h2><button type="button" onClick={() => onEdit(question)} className="min-h-[44px] rounded-lg px-3 text-sm font-bold text-moss-green hover:bg-emerald-50">Edit {title.toLowerCase()}</button></div>{children}</section>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="grid gap-1 border-t border-gray-100 py-2 text-sm sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-gray-500">{label}</dt><dd className="break-words font-semibold text-stone-dark">{value}</dd></div>;
}

interface Props { draft: GuidedEventDraft; onEdit: (question: GuidedQuestionId) => void }

export function ReviewQuestion({ draft, onEdit }: Props) {
  const venues = draft.venueMode === 'single' ? [draft.singleVenue?.name || 'Not added yet'] : draft.participatingVenues.map((venue) => venue.name);
  const bookingUrl = draft.attendanceMode === 'external' ? draft.externalUrl : draft.attendanceMode === 'door' && draft.doorReservationRequired ? draft.doorReservationUrl : '';
  return <div className="space-y-4">
    <p className="rounded-2xl border border-golden-heather/40 bg-golden-heather/10 p-4 text-sm font-semibold text-highland-green">Development preview only. Nothing here is submitted, uploaded or published.</p>
    <ReviewSection title="Event name" question="title" onEdit={onEdit}><p className="text-base font-semibold text-stone-dark">{draft.title || 'Not added yet'}</p></ReviewSection>
    <ReviewSection title="Location" question="venue" onEdit={onEdit}><dl><Row label={draft.venueMode === 'single' ? 'One venue' : 'Participating venues'} value={venues.length ? venues.join(', ') : 'Not added yet'} /></dl></ReviewSection>
    <ReviewSection title="Schedule" question="schedule" onEdit={onEdit}><p className="text-sm font-semibold text-stone-dark">{scheduleSummary(draft)}</p>{draft.scheduleMode === 'selected_dates' && <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-gray-700">{[...draft.performances].sort((a, b) => a.start.localeCompare(b.start)).map((performance) => <li key={performance.id}>{formatLocalDateTime(performance.start)} → {formatLocalDateTime(performance.end)} · UK time</li>)}</ol>}</ReviewSection>
    <ReviewSection title="Attendance" question="attendance" onEdit={onEdit}><dl><Row label="Method" value={attendanceSummary(draft)} />{bookingUrl && <Row label={draft.attendanceMode === 'door' ? 'Reservation URL' : 'Booking URL'} value={isHttpUrl(bookingUrl) ? bookingUrl : 'Invalid URL — edit attendance'} />}{draft.attendanceMode === 'native' && nativeTicketIssue(draft) && <Row label="Ticket eligibility" value={nativeTicketIssue(draft)} />}</dl></ReviewSection>
    {draft.attendanceMode === 'native' && <ReviewSection title="Tickets" question="tickets" onEdit={onEdit}><dl>{draft.ticketTiers.map((tier) => <Row key={tier.id} label={tier.name || 'Unnamed tier'} value={`£${Number.isFinite(tier.price) ? tier.price.toFixed(2) : '—'} · ${tier.quantity_available} available · max ${tier.max_per_order} per order`} />)}<Row label="Booking fees" value={draft.passFeesToBuyer ? 'Passed to buyer' : 'Absorbed by seller'} /></dl><p className="mt-3 text-sm text-amber-900">A charges-enabled Stripe seller is required before publishing. This preview does not connect Stripe or sell tickets.</p></ReviewSection>}
    <ReviewSection title="Event details" question="details" onEdit={onEdit}><dl><Row label="Category" value={draft.categoryName || 'Not added yet'} /><Row label="Host" value={draft.organizerName || 'Personal profile'} /></dl>{draft.description && <div className="mt-3 border-t border-gray-100 pt-3"><p className="mb-2 text-sm font-medium text-gray-500">Description</p><RichText content={draft.description} /></div>}</ReviewSection>
    <ReviewSection title="Photo and extras" question="finishing" onEdit={onEdit}>{draft.imagePreviewUrl && <img src={draft.imagePreviewUrl} alt="Selected event photo preview" className="mb-4 max-h-56 w-full rounded-xl object-cover" />}<dl><Row label="Photo" value={draft.imageName || 'None selected'} /><Row label="Tags" value={draft.tags.length ? draft.tags.join(', ') : 'None'} /><Row label="Age restriction" value={draft.ageRestriction || 'All ages welcome'} /><Row label="Website" value={draft.websiteUrl || 'Not added'} /></dl></ReviewSection>
    <p className="text-center text-sm text-gray-500">Submission and event editing are deliberately unavailable in this preview.</p>
  </div>;
}
