import { ChevronDown, MapPin, Sparkles } from 'lucide-react';
import type { GuidedEventDraft, GuidedQuestionId } from './guidedEventTypes';

interface SummaryContentProps {
  draft: GuidedEventDraft;
  onEdit: (question: GuidedQuestionId) => void;
}

function SummaryContent({ draft, onEdit }: SummaryContentProps) {
  const locationValue = draft.venueMode === 'single'
    ? draft.singleVenue?.name || 'Not added yet'
    : draft.participatingVenues.length > 0
      ? `${draft.participatingVenues.length} ${draft.participatingVenues.length === 1 ? 'venue' : 'venues'} · ${draft.participatingVenues.map((venue) => venue.name).join(', ')}`
      : 'Not added yet';
  const items: Array<{ id: GuidedQuestionId; label: string; value: string }> = [
    { id: 'title', label: 'Event name', value: draft.title.trim() || 'Not added yet' },
    { id: 'venue', label: draft.venueMode === 'single' ? 'Venue' : 'Venues', value: locationValue },
  ];

  return (
    <div className="space-y-1" data-testid="guided-summary-content">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onEdit(item.id)}
          className="group flex min-h-[64px] w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-emerald-50 focus-visible:bg-emerald-50"
          aria-label={`Edit ${item.label}`}
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
            Edit
          </span>
        </button>
      ))}
      <div className="mt-3 flex items-start gap-2 border-t border-gray-200 px-3 pt-4 text-xs leading-5 text-gray-500">
        <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss-green" />
        <span>More event details will be added in later phases.</span>
      </div>
    </div>
  );
}

interface GuidedEventSummaryProps extends SummaryContentProps {
  variant: 'mobile' | 'desktop';
}

export function GuidedEventSummary({ draft, onEdit, variant }: GuidedEventSummaryProps) {
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
          <SummaryContent draft={draft} onEdit={onEdit} />
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
        <SummaryContent draft={draft} onEdit={onEdit} />
      </div>
    </aside>
  );
}
