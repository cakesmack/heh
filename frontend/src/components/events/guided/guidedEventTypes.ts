import type { VenueResponse } from '@/types';

export type GuidedQuestionId = 'title' | 'venue';
export type VenueMode = 'single' | 'multiple';

export interface GuidedEventDraft {
  title: string;
  venueMode: VenueMode;
  singleVenueId: string | null;
  singleVenue: VenueResponse | null;
  participatingVenues: VenueResponse[];
}

export const GUIDED_QUESTIONS: Array<{
  id: GuidedQuestionId;
  phase: string;
  label: string;
}> = [
  { id: 'title', phase: 'About your event', label: 'Event name' },
  { id: 'venue', phase: 'When & where', label: 'Venue' },
];
