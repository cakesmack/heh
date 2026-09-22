import { useCallback, useState } from 'react';
import type { VenueResponse } from '@/types';
import type { GuidedEventDraft, VenueMode } from './guidedEventTypes';

const INITIAL_DRAFT: GuidedEventDraft = {
  title: '',
  venueMode: 'single',
  singleVenueId: null,
  singleVenue: null,
  participatingVenues: [],
};

export function useGuidedEventPreview() {
  const [draft, setDraft] = useState<GuidedEventDraft>(INITIAL_DRAFT);

  const setTitle = useCallback((title: string) => {
    setDraft((current) => ({ ...current, title }));
  }, []);

  const setVenueMode = useCallback((venueMode: VenueMode) => {
    setDraft((current) => ({ ...current, venueMode }));
  }, []);

  const setSingleVenue = useCallback((singleVenueId: string | null, singleVenue: VenueResponse | null) => {
    setDraft((current) => ({ ...current, singleVenueId, singleVenue }));
  }, []);

  const setParticipatingVenues = useCallback((participatingVenues: VenueResponse[]) => {
    const uniqueVenues = Array.from(new Map(participatingVenues.map((venue) => [venue.id, venue])).values());
    setDraft((current) => ({ ...current, participatingVenues: uniqueVenues }));
  }, []);

  return { draft, setTitle, setVenueMode, setSingleVenue, setParticipatingVenues };
}
