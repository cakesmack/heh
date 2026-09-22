import type { VenueResponse } from '@/types';

export type GuidedQuestionId = 'title' | 'venue';

export interface GuidedEventDraft {
  title: string;
  venueId: string | null;
  venue: VenueResponse | null;
}

export const GUIDED_QUESTIONS: Array<{
  id: GuidedQuestionId;
  phase: string;
  label: string;
}> = [
  { id: 'title', phase: 'About your event', label: 'Event name' },
  { id: 'venue', phase: 'When & where', label: 'Venue' },
];
