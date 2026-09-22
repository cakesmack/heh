import type { VenueResponse } from '@/types';

export type GuidedQuestionId = 'title' | 'venue' | 'schedule';
export type VenueMode = 'single' | 'multiple';
export type ScheduleMode = 'once' | 'recurring' | 'selected_dates';
export type ScheduleDateTime = { start: string; end: string; allDay: boolean };
export type Performance = { id: string; start: string; end: string };
export type RecurrenceSchedule = {
  startDate: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  allDay: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weekdays: number[];
  monthlyMode: 'date' | 'ordinal';
  ordinal: number;
  ordinalWeekday: number;
  endsOn: 'date' | 'ongoing';
  endDate: string;
};

export interface GuidedEventDraft {
  title: string;
  venueMode: VenueMode;
  singleVenueId: string | null;
  singleVenue: VenueResponse | null;
  participatingVenues: VenueResponse[];
  scheduleMode: ScheduleMode | null;
  once: ScheduleDateTime;
  performances: Performance[];
  recurrence: RecurrenceSchedule;
}

export const GUIDED_QUESTIONS: Array<{
  id: GuidedQuestionId;
  phase: string;
  label: string;
}> = [
  { id: 'title', phase: 'About your event', label: 'Event name' },
  { id: 'venue', phase: 'When & where', label: 'Venue' },
  { id: 'schedule', phase: 'When & where', label: 'Schedule' },
];
