import { useCallback, useEffect, useState } from 'react';
import type { VenueResponse } from '@/types';
import type { GuidedEventDraft, VenueMode, ScheduleMode, ScheduleDateTime, Performance, RecurrenceSchedule } from './guidedEventTypes';

const INITIAL_DRAFT: GuidedEventDraft = {
  title: '',
  venueMode: 'single',
  singleVenueId: null,
  singleVenue: null,
  participatingVenues: [],
  scheduleMode: null,
  once: { start: '', end: '', allDay: false },
  performances: [],
  recurrence: {
    startDate: '', startTime: '12:00', endTime: '14:00', endsNextDay: false,
    allDay: false, frequency: 'weekly', interval: 1, weekdays: [],
    monthlyMode: 'date', ordinal: 1, ordinalWeekday: 0,
    endsOn: 'date', endDate: '',
  },
  attendanceMode: null,
  doorPrice: '', doorReservationRequired: false, doorReservationUrl: '',
  externalUrl: '', externalIsFree: null,
  ticketTiers: [], passFeesToBuyer: false,
  description: '', categoryId: '', categoryName: '', organizerId: '', organizerName: '',
  tags: [], ageRestriction: '', websiteUrl: '', imageName: '', imagePreviewUrl: '',
};

export function useGuidedEventPreview() {
  const [draft, setDraft] = useState<GuidedEventDraft>(INITIAL_DRAFT);
  useEffect(() => {
    const previewUrl = draft.imagePreviewUrl;
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [draft.imagePreviewUrl]);

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

  const setScheduleMode = useCallback((scheduleMode: ScheduleMode) => {
    setDraft((current) => ({ ...current, scheduleMode }));
  }, []);

  const setOnce = useCallback((patch: Partial<ScheduleDateTime>) => {
    setDraft((current) => ({ ...current, once: { ...current.once, ...patch } }));
  }, []);

  const setPerformances = useCallback((performances: Performance[]) => {
    setDraft((current) => ({ ...current, performances }));
  }, []);

  const setRecurrence = useCallback((patch: Partial<RecurrenceSchedule>) => {
    setDraft((current) => ({ ...current, recurrence: { ...current.recurrence, ...patch } }));
  }, []);

  const updateDraft = useCallback((patch: Partial<GuidedEventDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  return { draft, setTitle, setVenueMode, setSingleVenue, setParticipatingVenues, setScheduleMode, setOnce, setPerformances, setRecurrence, updateDraft };
}
