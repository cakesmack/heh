import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Mountain } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { EventResponse } from '@/types';
import { EventTitleQuestion } from './EventTitleQuestion';
import { GuidedEventSummary } from './GuidedEventSummary';
import { getGuidedQuestions, type GuidedQuestionId } from './guidedEventTypes';
import { useGuidedEventPreview } from './useGuidedEventPreview';
import { VenueQuestion } from './VenueQuestion';
import { ScheduleQuestion } from './ScheduleQuestion';
import { AttendanceQuestion } from './AttendanceQuestion';
import { TicketsQuestion } from './TicketsQuestion';
import { DetailsQuestion } from './DetailsQuestion';
import { FinishingQuestion } from './FinishingQuestion';
import { ReviewQuestion } from './ReviewQuestion';
import { GuidedCreationSuccess } from './GuidedCreationSuccess';
import { buildGuidedEventPayload, validateGuidedCreation } from './guidedCreation';
import { validateAttendance, validateDetails, validateFinishing, validateTickets } from './guidedFormHelpers';
import { addLocalDay, applyOnceChange, validDate, validateInterval, validateRecurrence, validateSchedule } from './scheduleHelpers';
import styles from './GuidedEventFormPreview.module.css';

type Direction = 'forward' | 'backward';

export default function GuidedEventFormPreview() {
  const { user } = useAuth();
  const { draft, setTitle, setVenueMode, setSingleVenue, setParticipatingVenues, setScheduleMode, setOnce, setPerformances, setRecurrence, updateDraft } = useGuidedEventPreview();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [schedulePart, setSchedulePart] = useState(0);
  const [direction, setDirection] = useState<Direction>('forward');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<GuidedQuestionId, string>>>({});
  const [onceEndReset, setOnceEndReset] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState<'idle' | 'checking-seller' | 'uploading' | 'creating'>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [ticketSellerReady, setTicketSellerReady] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<EventResponse | null>(null);
  const submittingRef = useRef(false);
  const uploadedImageRef = useRef<{ file: File; url: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const venueInputRef = useRef<HTMLInputElement>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const visibleQuestions = getGuidedQuestions(draft.attendanceMode);
  const currentQuestion = visibleQuestions[questionIndex];
  const availableQuestionIds = visibleQuestions.slice(0, questionIndex + 1).map((question) => question.id);

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [questionIndex, schedulePart]);

  useEffect(() => () => {
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
  }, []);

  useEffect(() => { setTicketSellerReady(false); }, [draft.organizerId]);

  const handleSellerReadyChange = useCallback((ready: boolean) => {
    setTicketSellerReady(ready);
    if (ready) setErrors((current) => ({ ...current, tickets: undefined }));
  }, []);

  const moveToQuestion = useCallback((targetIndex: number, nextDirection?: Direction, targetSchedulePart = 0) => {
    if (isTransitioning || submittingRef.current || targetIndex === questionIndex || targetIndex < 0 || targetIndex >= visibleQuestions.length) return;
    setDirection(nextDirection ?? (targetIndex > questionIndex ? 'forward' : 'backward'));
    setIsTransitioning(true);
    setQuestionIndex(targetIndex);
    if (visibleQuestions[targetIndex]?.id === 'schedule') setSchedulePart(targetSchedulePart);
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => setIsTransitioning(false), 260);
  }, [isTransitioning, questionIndex, visibleQuestions.length]);

  const moveSchedulePart = (part: number, nextDirection: Direction) => {
    if (isTransitioning) return;
    setDirection(nextDirection);
    setIsTransitioning(true);
    setErrors((current) => ({ ...current, schedule: undefined }));
    setSchedulePart(part);
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => setIsTransitioning(false), 260);
  };

  const schedulePartCount = draft.scheduleMode === 'recurring' ? 3 : 1;
  const progressTotal = visibleQuestions.length;
  const progressCurrent = questionIndex + 1;

  const validateSchedulePart = (): string | null => {
    if (!draft.scheduleMode) return 'Choose how your event is scheduled.';
    if (schedulePart === 0) return null;
    if (draft.scheduleMode === 'once') return validateSchedule(draft);
    if (draft.scheduleMode === 'recurring' && schedulePart === 1) {
      if (!validDate(draft.recurrence.startDate)) return 'Choose the first event date.';
      if (draft.recurrence.allDay) return null;
      const endDate = draft.recurrence.endsNextDay ? addLocalDay(draft.recurrence.startDate) : draft.recurrence.startDate;
      return validateInterval(`${draft.recurrence.startDate}T${draft.recurrence.startTime}`, `${endDate}T${draft.recurrence.endTime}`);
    }
    if (draft.scheduleMode === 'recurring' && schedulePart === 2) {
      if (!Number.isInteger(draft.recurrence.interval) || draft.recurrence.interval < 1 || draft.recurrence.interval > 100) return 'Enter a repeat interval from 1 to 100.';
      if (draft.recurrence.frequency === 'weekly' && draft.recurrence.weekdays.length === 0) return 'Choose at least one weekday.';
      return null;
    }
    return draft.scheduleMode === 'recurring' ? validateRecurrence(draft.recurrence) : validateSchedule(draft);
  };

  const validateCurrentQuestion = () => {
    if (currentQuestion.id === 'title' && !draft.title.trim()) {
      setErrors((current) => ({ ...current, title: 'Add an event name before continuing.' }));
      titleInputRef.current?.focus();
      return false;
    }
    const hasValidVenue = draft.venueMode === 'single'
      ? Boolean(draft.singleVenueId)
      : draft.participatingVenues.length > 0;
    if (currentQuestion.id === 'venue' && !hasValidVenue) {
      const message = draft.venueMode === 'single'
        ? 'Choose a registered venue before continuing.'
        : 'Add at least one participating venue before continuing.';
      setErrors((current) => ({ ...current, venue: message }));
      venueInputRef.current?.focus();
      return false;
    }
    if (currentQuestion.id === 'tickets' && !ticketSellerReady) {
      setErrors((current) => ({ ...current, tickets: 'Connect Stripe payouts for the selected host before continuing.' }));
      headingRef.current?.focus();
      return false;
    }
    const issue = currentQuestion.id === 'attendance' ? validateAttendance(draft)
      : currentQuestion.id === 'tickets' ? validateTickets(draft)
        : currentQuestion.id === 'details' ? validateDetails(draft)
          : currentQuestion.id === 'finishing' ? validateFinishing(draft) : null;
    if (issue) {
      setErrors((current) => ({ ...current, [currentQuestion.id]: issue }));
      headingRef.current?.focus();
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (!validateCurrentQuestion()) return;
    if (currentQuestion.id === 'schedule') {
      const issue = validateSchedulePart();
      if (issue) {
        setErrors((current) => ({ ...current, schedule: issue }));
        document.getElementById(schedulePart === 0 ? 'schedule-mode-once' : draft.scheduleMode === 'once' ? (draft.once.start ? 'schedule-once-end' : 'schedule-once-start') : draft.scheduleMode === 'recurring' ? ['','recurrence-first-date','recurrence-frequency','recurrence-end-date'][schedulePart] : 'schedule-add-performance')?.focus();
        return;
      }
      if (schedulePart < schedulePartCount) moveSchedulePart(schedulePart + 1, 'forward');
      else moveToQuestion(questionIndex + 1, 'forward');
      return;
    }
    if (questionIndex < visibleQuestions.length - 1) {
      moveToQuestion(questionIndex + 1, 'forward');
    }
  };

  const handleBack = () => {
    if (submittingRef.current) return;
    if (currentQuestion.id === 'schedule' && schedulePart > 0) { moveSchedulePart(schedulePart - 1, 'backward'); return; }
    if (questionIndex > 0) {
      moveToQuestion(questionIndex - 1, 'backward', visibleQuestions[questionIndex - 1]?.id === 'schedule' ? schedulePartCount : 0);
    }
  };

  const handleSummaryEdit = (question: GuidedQuestionId) => {
    if (submittingRef.current) return;
    if (question === 'schedule' && currentQuestion.id === 'schedule' && schedulePart > 0) {
      moveSchedulePart(0, 'backward');
      return;
    }
    const targetIndex = visibleQuestions.findIndex((item) => item.id === question);
    moveToQuestion(targetIndex);
  };

  const handleAdditionalChange = (patch: Parameters<typeof updateDraft>[0]) => {
    if (submittingRef.current) return;
    updateDraft(patch);
    setSubmissionError(null);
    setErrors((current) => ({ ...current, [currentQuestion.id]: undefined }));
  };

  const handleCreateEvent = async () => {
    if (submittingRef.current || createdEvent) return;
    setSubmissionError(null);
    const issue = validateGuidedCreation(draft);
    if (issue) {
      setErrors((current) => ({ ...current, [issue.question]: issue.message }));
      if (issue.question === 'schedule') setSchedulePart(schedulePartCount);
      moveToQuestion(visibleQuestions.findIndex((question) => question.id === issue.question), 'backward', issue.question === 'schedule' ? schedulePartCount : 0);
      return;
    }
    if (!user) { setSubmissionError('Sign in before creating this event. Your answers remain in this tab.'); return; }
    submittingRef.current = true;
    let createAttempted = false;
    try {
      if (draft.attendanceMode === 'native') {
        setSubmissionPhase('checking-seller');
        const seller = await api.sellers.getStatus(draft.organizerId || null);
        if (!seller.charges_enabled) throw new Error('Stripe payouts are not active for the selected host. Edit Tickets to connect Stripe before creating this event.');
      }
      let imageUrl: string | undefined;
      if (draft.imageFile) {
        if (uploadedImageRef.current?.file === draft.imageFile) imageUrl = uploadedImageRef.current.url;
        else {
          setSubmissionPhase('uploading');
          const uploaded = await api.media.upload(draft.imageFile, 'events');
          imageUrl = uploaded.url;
          uploadedImageRef.current = { file: draft.imageFile, url: imageUrl };
        }
      }
      const payload = buildGuidedEventPayload(draft, imageUrl);
      setSubmissionPhase('creating');
      createAttempted = true;
      const event = await api.events.create(payload);
      setCreatedEvent(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Event creation failed.';
      setSubmissionError(createAttempted ? `${message} If the connection failed after submission, check your dashboard before trying again.` : message);
    } finally {
      submittingRef.current = false;
      setSubmissionPhase('idle');
    }
  };

  const title = currentQuestion.id === 'title' ? 'What is your event called?'
    : currentQuestion.id === 'venue' ? 'Where is it happening?'
      : currentQuestion.id === 'attendance' ? 'How can people attend?'
        : currentQuestion.id === 'tickets' ? 'Set up your tickets'
          : currentQuestion.id === 'details' ? 'Tell people about your event'
            : currentQuestion.id === 'finishing' ? 'Add a photo and finishing details'
              : currentQuestion.id === 'review' ? 'Review your event'
      : schedulePart === 0 ? 'When does your event happen?'
        : draft.scheduleMode === 'once' ? 'When does it start and finish?'
          : draft.scheduleMode === 'recurring' ? ['','When is the first event?','How often does it happen?','When should it stop?'][schedulePart]
            : 'Add your dates and times';
  const help = currentQuestion.id === 'title' ? 'Start with the clearest name for people browsing events across the Highlands.'
    : currentQuestion.id === 'venue' ? 'Find the registered venue where visitors should arrive.'
      : currentQuestion.id === 'attendance' ? 'Choose the route visitors will use. We will only show the fields that apply.'
        : currentQuestion.id === 'tickets' ? 'Connect Stripe payouts and configure ticket tiers for your one-off event.'
          : currentQuestion.id === 'details' ? 'Help visitors understand what to expect and who is hosting.'
            : currentQuestion.id === 'finishing' ? 'Make your listing yours. The photo uploads only when you create the event.'
              : currentQuestion.id === 'review' ? 'Check every answer and edit any section before creating your event.'
      : schedulePart === 0 ? 'Choose the pattern that best describes your event.'
        : 'Set the dates and times visitors will see. All times are in the UK event timezone.';

  if (createdEvent) return <div className="min-h-screen bg-warm-white px-4 py-12 sm:py-20"><GuidedCreationSuccess event={createdEvent} /></div>;

  return (
    <div className="relative overflow-hidden bg-warm-white">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-50 to-transparent" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-highland-green text-white shadow-soft">
              <Mountain aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss-green">Guided event form</p>
              <p className="text-sm font-semibold text-highland-green">Create an event</p>
            </div>
          </div>
          <span className="rounded-full border border-golden-heather/30 bg-golden-heather/10 px-3 py-1.5 text-xs font-bold text-highland-green">
            Local development route · creates real events
          </span>
        </div>

        <div className="mb-5 rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-card" aria-label={`Question ${progressCurrent} of ${progressTotal}`}>
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-highland-green">Question {progressCurrent} of {progressTotal}</p>
            <p className="text-xs font-medium text-gray-500">{currentQuestion.id === 'schedule' ? (draft.scheduleMode ? `Schedule step ${schedulePart + 1} of ${schedulePartCount + 1}` : 'Choose a schedule') : currentQuestion.phase}</p>
          </div>
          <div role="progressbar" aria-valuemin={1} aria-valuemax={progressTotal} aria-valuenow={progressCurrent} className="flex gap-2">
            {Array.from({ length: progressTotal }, (_, index) => (
              <span key={index} className={`h-2 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${index < progressCurrent ? 'bg-moss-green' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="mb-5 lg:hidden">
          <GuidedEventSummary variant="mobile" draft={draft} onEdit={handleSummaryEdit} availableQuestionIds={availableQuestionIds} />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-card" aria-labelledby="guided-question-heading">
            <div className="p-6 sm:p-9 lg:p-12">
              <div key={`${currentQuestion.id}-${currentQuestion.id === 'schedule' ? schedulePart : 0}`} className={direction === 'forward' ? styles.questionForward : styles.questionBackward} data-testid="guided-question-panel">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-moss-green">{currentQuestion.phase}</p>
                <h1 ref={headingRef} id="guided-question-heading" tabIndex={-1} className="max-w-2xl text-3xl font-bold tracking-tight text-highland-green focus:outline-none sm:text-4xl">
                  {title}
                </h1>
                <p className="mb-8 mt-3 max-w-xl text-base leading-7 text-gray-600">{help}</p>

                {currentQuestion.id === 'title' ? (
                  <EventTitleQuestion
                    value={draft.title}
                    error={errors.title}
                    inputRef={titleInputRef}
                    onChange={(value) => {
                      setTitle(value);
                      if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
                    }}
                  />
                ) : currentQuestion.id === 'venue' ? (
                  <VenueQuestion
                    mode={draft.venueMode}
                    singleVenueId={draft.singleVenueId}
                    singleVenue={draft.singleVenue}
                    participatingVenues={draft.participatingVenues}
                    error={errors.venue}
                    inputRef={venueInputRef}
                    onModeChange={(mode) => {
                      setVenueMode(mode);
                      if (errors.venue) setErrors((current) => ({ ...current, venue: undefined }));
                    }}
                    onSingleVenueChange={(venueId, venue) => {
                      setSingleVenue(venueId, venue);
                      if (errors.venue) setErrors((current) => ({ ...current, venue: undefined }));
                    }}
                    onParticipatingVenuesChange={(venues) => {
                      setParticipatingVenues(venues);
                      if (errors.venue) setErrors((current) => ({ ...current, venue: undefined }));
                    }}
                  />
                ) : currentQuestion.id === 'schedule' ? (
                  <ScheduleQuestion draft={draft} part={schedulePart} error={errors.schedule} onceEndReset={onceEndReset}
                    onModeChange={(mode) => { setScheduleMode(mode); setErrors((current) => ({ ...current, schedule: undefined })); }}
                    onOnceChange={(patch) => { const change = applyOnceChange(draft.once, patch); setOnce(change.value); setOnceEndReset(change.endCleared ? true : 'end' in patch ? false : onceEndReset); setErrors((current) => ({ ...current, schedule: undefined })); }}
                    onPerformancesChange={(items) => { setPerformances(items); setErrors((current) => ({ ...current, schedule: undefined })); }}
                    onRecurrenceChange={(patch) => { setRecurrence(patch); setErrors((current) => ({ ...current, schedule: undefined })); }}
                  />
                ) : currentQuestion.id === 'attendance' ? (
                  <AttendanceQuestion draft={draft} error={errors.attendance} onChange={handleAdditionalChange} />
                ) : currentQuestion.id === 'tickets' ? (
                  <TicketsQuestion draft={draft} error={errors.tickets} onChange={handleAdditionalChange} onChooseAnotherMethod={() => moveToQuestion(visibleQuestions.findIndex((item) => item.id === 'attendance'), 'backward')} onSellerReadyChange={handleSellerReadyChange} />
                ) : currentQuestion.id === 'details' ? (
                  <DetailsQuestion draft={draft} error={errors.details} onChange={handleAdditionalChange} />
                ) : currentQuestion.id === 'finishing' ? (
                  <FinishingQuestion draft={draft} error={errors.finishing} onChange={handleAdditionalChange} />
                ) : (
                  <ReviewQuestion draft={draft} onEdit={handleSummaryEdit} onChange={handleAdditionalChange} error={errors.review} />
                )}
              </div>

              {currentQuestion.id === 'review' && submissionError && <p role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{submissionError}</p>}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:px-9 lg:px-12">
              <Button type="button" variant="ghost" onClick={handleBack} disabled={(questionIndex === 0 && schedulePart === 0) || isTransitioning || submissionPhase !== 'idle'} className="min-h-[48px] !rounded-xl">
                <span className="inline-flex items-center gap-2"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back</span>
              </Button>
              <Button type="button" onClick={currentQuestion.id === 'review' ? handleCreateEvent : handleContinue} disabled={isTransitioning || submissionPhase !== 'idle'} className="min-h-[48px] min-w-[132px] !rounded-xl">
                <span className="inline-flex items-center gap-2">{currentQuestion.id === 'review' ? submissionPhase === 'checking-seller' ? 'Checking seller…' : submissionPhase === 'uploading' ? 'Uploading photo…' : submissionPhase === 'creating' ? 'Creating event…' : 'Create Event' : 'Continue'}<ArrowRight aria-hidden="true" className="h-4 w-4" /></span>
              </Button>
            </div>
          </section>

          <div className="hidden lg:block">
            <GuidedEventSummary variant="desktop" draft={draft} onEdit={handleSummaryEdit} availableQuestionIds={availableQuestionIds} />
          </div>
        </div>
      </div>
    </div>
  );
}
