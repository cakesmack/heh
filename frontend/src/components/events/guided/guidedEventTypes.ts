import type { VenueResponse } from '@/types';
import type { TicketTierCreate } from '@/hooks/useEventWizard';

export type GuidedQuestionId = 'title' | 'venue' | 'schedule' | 'attendance' | 'tickets' | 'details' | 'finishing' | 'review';
export type VenueMode = 'single' | 'multiple';
export type ScheduleMode = 'once' | 'recurring' | 'selected_dates';
export type ScheduleDateTime = { start: string; end: string; allDay: boolean };
export type Performance = { id: string; start: string; end: string };
export type AttendanceMode = 'free' | 'door' | 'external' | 'native';
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
  attendanceMode: AttendanceMode | null;
  doorPrice: string;
  doorReservationRequired: boolean;
  doorReservationUrl: string;
  externalUrl: string;
  externalIsFree: boolean | null;
  ticketTiers: Array<TicketTierCreate & { id: string }>;
  passFeesToBuyer: boolean;
  description: string;
  categoryId: string;
  categoryName: string;
  organizerId: string;
  organizerName: string;
  tags: string[];
  ageRestriction: string;
  websiteUrl: string;
  imageName: string;
  imagePreviewUrl: string;
  imageFile: File | null;
}

export const GUIDED_QUESTIONS: Array<{
  id: GuidedQuestionId;
  phase: string;
  label: string;
}> = [
  { id: 'title', phase: 'About your event', label: 'Event name' },
  { id: 'venue', phase: 'When & where', label: 'Venue' },
  { id: 'schedule', phase: 'When & where', label: 'Schedule' },
  { id: 'attendance', phase: 'Attending', label: 'Attendance' },
  { id: 'tickets', phase: 'Attending', label: 'Tickets' },
  { id: 'details', phase: 'Event details', label: 'Details' },
  { id: 'finishing', phase: 'Finishing touches', label: 'Photo and extras' },
  { id: 'review', phase: 'Review', label: 'Review' },
];

export function getGuidedQuestions(attendanceMode: AttendanceMode | null) {
  return GUIDED_QUESTIONS.filter((question) => question.id !== 'tickets' || attendanceMode === 'native');
}
