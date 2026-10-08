import type { RefObject } from 'react';
import { Building2, MapPin, Milestone } from 'lucide-react';
import MultiVenueSelector from '@/components/venues/MultiVenueSelector';
import { UnifiedVenueSelect } from '@/components/venues/UnifiedVenueSelect';
import type { VenueResponse } from '@/types';
import type { VenueMode } from './guidedEventTypes';

interface VenueQuestionProps {
  mode: VenueMode;
  singleVenueId: string | null;
  singleVenue: VenueResponse | null;
  participatingVenues: VenueResponse[];
  existingLocationName?: string;
  error?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onModeChange: (mode: VenueMode) => void;
  onSingleVenueChange: (venueId: string | null, venue: VenueResponse | null) => void;
  onParticipatingVenuesChange: (venues: VenueResponse[]) => void;
}

const modes: Array<{ id: VenueMode; title: string; description: string; icon: typeof Building2 }> = [
  { id: 'single', title: 'One venue', description: 'Everyone arrives at the same place.', icon: Building2 },
  { id: 'multiple', title: 'Multiple venues', description: 'Your event is spread across several places.', icon: Milestone },
];

export function VenueQuestion({
  mode,
  singleVenueId,
  singleVenue,
  participatingVenues,
  existingLocationName,
  error,
  inputRef,
  onModeChange,
  onSingleVenueChange,
  onParticipatingVenuesChange,
}: VenueQuestionProps) {
  const descriptionId = error ? 'guided-venue-help guided-venue-error' : 'guided-venue-help';

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="sr-only">Choose the venue setup</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {modes.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.id;
            return (
              <label
                key={option.id}
                className={`flex min-h-[92px] cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors ${
                  selected
                    ? 'border-moss-green bg-emerald-50 text-highland-green'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="guided-venue-mode"
                  value={option.id}
                  checked={selected}
                  onChange={() => onModeChange(option.id)}
                  className="sr-only"
                />
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-moss-green text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-bold">{option.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-gray-600">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {mode === 'multiple' && singleVenue && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-highland-green">Existing main venue: {singleVenue.name}. It will be preserved alongside the participating venues.</p>}

      {mode === 'single' ? (
        <div className="space-y-3">
          {existingLocationName && !singleVenueId && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-highland-green">Current location: {existingLocationName}. Keep this location or choose a registered venue below.</p>}
          <label htmlFor="guided-event-venue" className="block text-sm font-semibold text-gray-800">
            Choose the venue
          </label>
          <UnifiedVenueSelect
            value={singleVenueId}
            onChange={(venueId, venue) => onSingleVenueChange(venueId || null, venue)}
            placeholder="Search for a venue or place..."
            error={error}
            inputId="guided-event-venue"
            inputRef={inputRef}
            ariaDescribedBy={descriptionId}
            initialVenue={singleVenue}
            errorId="guided-venue-error"
          />
        </div>
      ) : (
        <MultiVenueSelector
          selectedVenues={participatingVenues}
          onChange={onParticipatingVenuesChange}
          inputId="guided-event-venue"
          inputRef={inputRef}
          error={error}
          ariaDescribedBy={descriptionId}
          errorId="guided-venue-error"
        />
      )}

      <div id="guided-venue-help" className="flex items-start gap-2 rounded-xl bg-loch-blue/5 px-3.5 py-3 text-sm leading-5 text-gray-600">
        <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-loch-blue" />
        <span>
          Search existing venues first, or choose a place from Google Maps to add it as an unverified venue.
        </span>
      </div>
    </div>
  );
}
