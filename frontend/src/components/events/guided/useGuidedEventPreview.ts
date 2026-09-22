import { useCallback, useState } from 'react';
import type { VenueResponse } from '@/types';
import type { GuidedEventDraft } from './guidedEventTypes';

const INITIAL_DRAFT: GuidedEventDraft = {
  title: '',
  venueId: null,
  venue: null,
};

export function useGuidedEventPreview() {
  const [draft, setDraft] = useState<GuidedEventDraft>(INITIAL_DRAFT);

  const setTitle = useCallback((title: string) => {
    setDraft((current) => ({ ...current, title }));
  }, []);

  const setVenue = useCallback((venueId: string | null, venue: VenueResponse | null) => {
    setDraft((current) => ({ ...current, venueId, venue }));
  }, []);

  return { draft, setTitle, setVenue };
}
