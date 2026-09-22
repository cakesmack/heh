import type { RefObject } from 'react';
import { MapPin } from 'lucide-react';
import { UnifiedVenueSelect } from '@/components/venues/UnifiedVenueSelect';
import type { VenueResponse } from '@/types';

interface VenueQuestionProps {
  value: string | null;
  selectedVenue: VenueResponse | null;
  error?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (venueId: string | null, venue: VenueResponse | null) => void;
}

export function VenueQuestion({ value, selectedVenue, error, inputRef, onChange }: VenueQuestionProps) {
  const descriptionId = error ? 'guided-venue-help guided-venue-error' : 'guided-venue-help';

  return (
    <div className="space-y-3">
      <label htmlFor="guided-event-venue" className="sr-only">
        Search registered venues
      </label>
      <UnifiedVenueSelect
        value={value}
        onChange={(venueId, venue) => onChange(venueId || null, venue)}
        placeholder="Search registered Highland venues..."
        disableGoogle
        error={error}
        inputId="guided-event-venue"
        inputRef={inputRef}
        ariaDescribedBy={descriptionId}
        initialVenue={selectedVenue}
      />
      <div id="guided-venue-help" className="flex items-start gap-2 rounded-xl bg-loch-blue/5 px-3.5 py-3 text-sm leading-5 text-gray-600">
        <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-loch-blue" />
        <span>
          Preview mode searches existing venues only. Choosing a result will not create or change a venue.
        </span>
      </div>
      {error && <span id="guided-venue-error" className="sr-only">{error}</span>}
    </div>
  );
}
