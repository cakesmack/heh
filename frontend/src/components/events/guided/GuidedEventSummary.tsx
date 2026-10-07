import { ChevronDown, Sparkles } from 'lucide-react';
import type { GuidedEventDraft, GuidedQuestionId } from './guidedEventTypes';
import { scheduleSummary } from './scheduleHelpers';
import { attendanceSummary } from './guidedFormHelpers';

interface SummaryContentProps {
  draft: GuidedEventDraft;
  onEdit: (question: GuidedQuestionId) => void;
  availableQuestionIds: GuidedQuestionId[];
}

function SummaryContent({ draft, onEdit, availableQuestionIds }: SummaryContentProps) {
  const locationValue = draft.venueMode === 'single'
    ? draft.singleVenue?.name || draft.existingLocationName || 'Not added yet'
    : draft.participatingVenues.length > 0
      ? `${draft.participatingVenues.length} ${draft.participatingVenues.length === 1 ? 'venue' : 'venues'} · ${draft.participatingVenues.map((venue) => venue.name).join(', ')}`
      : 'Not added yet';
  const items: Array<{ id: GuidedQuestionId; label: string; value: string }> = [
    { id: 'title', label: 'Event name', value: draft.title.trim() || 'Not added yet' },
    { id: 'venue', label: draft.venueMode === 'single' ? 'Venue' : 'Venues', value: locationValue },
    { id: 'schedule', label: 'Schedule', value: scheduleSummary(draft) },
    { id: 'attendance', label: 'Attendance', value: attendanceSummary(draft) },
    ...(draft.attendanceMode === 'native' ? [{ id: 'tickets' as const, label: 'Tickets', value: draft.ticketTiers.length ? `${draft.ticketTiers.length} ${draft.ticketTiers.length === 1 ? 'tier' : 'tiers'}` : 'Not added yet' }] : []),
    { id: 'details', label: 'Details', value: draft.categoryName || 'Not added yet' },
    { id: 'finishing', label: 'Photo and extras', value: [draft.imageName ? 'Photo' : '', draft.tags.length ? `${draft.tags.length} tags` : '', draft.ageRestriction || ''].filter(Boolean).join(' · ') || 'Not added yet' },
  ];

  return (
    <div className="space-y-1" data-testid="guided-summary-content">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onEdit(item.id)}
          disabled={!availableQuestionIds.includes(item.id)}
          className="group flex min-h-[64px] w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition-colors enabled:hover:bg-emerald-50 enabled:focus-visible:bg-emerald-50 disabled:cursor-default"
          aria-label={!availableQuestionIds.includes(item.id) ? `${item.label} comes later` : `Edit ${item.label}`}
        >
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
              {item.label}
            </span>
            <span title={item.value} className={`mt-1 block text-sm leading-5 ${item.value === 'Not added yet' ? 'text-gray-400' : 'font-semibold text-stone-dark'}`}>
              {item.value}
            </span>
          </span>
          <span className="text-xs font-semibold text-moss-green opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {!availableQuestionIds.includes(item.id) ? 'Later' : 'Edit'}
          </span>
        </button>
      ))}
      <p className="mt-3 border-t border-gray-200 px-3 pt-4 text-xs leading-5 text-gray-500">Your answers are saved only when you submit.</p>
    </div>
  );
}

interface GuidedEventSummaryProps extends SummaryContentProps {
  variant: 'mobile' | 'desktop';
}

export function GuidedEventSummary({ draft, onEdit, availableQuestionIds, variant }: GuidedEventSummaryProps) {
  if (variant === 'mobile') {
    return (
      <details className="group rounded-2xl border border-gray-200 bg-white shadow-card lg:hidden" data-testid="mobile-summary">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-highland-green marker:content-none">
          <span className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-golden-heather" />
            Your event
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="border-t border-gray-100 p-2">
          <SummaryContent draft={draft} onEdit={onEdit} availableQuestionIds={availableQuestionIds} />
        </div>
      </details>
    );
  }

  return (
    <aside className="hidden lg:block" aria-label="Live event summary" data-testid="desktop-summary">
      <div className="sticky top-24 rounded-3xl border border-gray-200 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-golden-heather/15 text-golden-heather">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-bold text-highland-green">Your event</h2>
            <p className="text-xs text-gray-500">Updates as you type</p>
          </div>
        </div>
        <SummaryContent draft={draft} onEdit={onEdit} availableQuestionIds={availableQuestionIds} />
      </div>
    </aside>
  );
}
