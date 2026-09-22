import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Mountain } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { EventTitleQuestion } from './EventTitleQuestion';
import { GuidedEventSummary } from './GuidedEventSummary';
import { GUIDED_QUESTIONS, type GuidedQuestionId } from './guidedEventTypes';
import { useGuidedEventPreview } from './useGuidedEventPreview';
import { VenueQuestion } from './VenueQuestion';
import styles from './GuidedEventFormPreview.module.css';

type Direction = 'forward' | 'backward';

export default function GuidedEventFormPreview() {
  const { draft, setTitle, setVenueMode, setSingleVenue, setParticipatingVenues } = useGuidedEventPreview();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [direction, setDirection] = useState<Direction>('forward');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<GuidedQuestionId, string>>>({});
  const [isComplete, setIsComplete] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const venueInputRef = useRef<HTMLInputElement>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const currentQuestion = GUIDED_QUESTIONS[questionIndex];

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [questionIndex]);

  useEffect(() => () => {
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
  }, []);

  const moveToQuestion = useCallback((targetIndex: number, nextDirection?: Direction) => {
    if (isTransitioning || targetIndex === questionIndex || targetIndex < 0 || targetIndex >= GUIDED_QUESTIONS.length) return;
    setDirection(nextDirection ?? (targetIndex > questionIndex ? 'forward' : 'backward'));
    setIsTransitioning(true);
    setIsComplete(false);
    setQuestionIndex(targetIndex);
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => setIsTransitioning(false), 260);
  }, [isTransitioning, questionIndex]);

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
    return true;
  };

  const handleContinue = () => {
    if (!validateCurrentQuestion()) return;
    if (questionIndex < GUIDED_QUESTIONS.length - 1) {
      moveToQuestion(questionIndex + 1, 'forward');
    } else {
      setIsComplete(true);
    }
  };

  const handleBack = () => {
    if (questionIndex > 0) moveToQuestion(questionIndex - 1, 'backward');
  };

  const handleSummaryEdit = (question: GuidedQuestionId) => {
    const targetIndex = GUIDED_QUESTIONS.findIndex((item) => item.id === question);
    moveToQuestion(targetIndex);
  };

  const title = currentQuestion.id === 'title' ? 'What is your event called?' : 'Where is it happening?';
  const help = currentQuestion.id === 'title'
    ? 'Start with the clearest name for people browsing events across the Highlands.'
    : 'Find the registered venue where visitors should arrive.';

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
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss-green">Guided form preview</p>
              <p className="text-sm font-semibold text-highland-green">Create an event · Phase 1</p>
            </div>
          </div>
          <span className="rounded-full border border-golden-heather/30 bg-golden-heather/10 px-3 py-1.5 text-xs font-bold text-highland-green">
            Development preview · nothing is submitted
          </span>
        </div>

        <div className="mb-5 rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-card" aria-label={`Question ${questionIndex + 1} of ${GUIDED_QUESTIONS.length}`}>
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-highland-green">Question {questionIndex + 1} of {GUIDED_QUESTIONS.length}</p>
            <p className="text-xs font-medium text-gray-500">{currentQuestion.phase}</p>
          </div>
          <div role="progressbar" aria-valuemin={1} aria-valuemax={GUIDED_QUESTIONS.length} aria-valuenow={questionIndex + 1} className="grid grid-cols-2 gap-2">
            {GUIDED_QUESTIONS.map((question, index) => (
              <span key={question.id} className={`h-2 rounded-full transition-colors duration-200 motion-reduce:transition-none ${index <= questionIndex ? 'bg-moss-green' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="mb-5 lg:hidden">
          <GuidedEventSummary variant="mobile" draft={draft} onEdit={handleSummaryEdit} />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-card" aria-labelledby="guided-question-heading">
            <div className="p-6 sm:p-9 lg:p-12">
              <div key={currentQuestion.id} className={direction === 'forward' ? styles.questionForward : styles.questionBackward} data-testid="guided-question-panel">
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
                      setIsComplete(false);
                      if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
                    }}
                  />
                ) : (
                  <VenueQuestion
                    mode={draft.venueMode}
                    singleVenueId={draft.singleVenueId}
                    singleVenue={draft.singleVenue}
                    participatingVenues={draft.participatingVenues}
                    error={errors.venue}
                    inputRef={venueInputRef}
                    onModeChange={(mode) => {
                      setVenueMode(mode);
                      setIsComplete(false);
                      if (errors.venue) setErrors((current) => ({ ...current, venue: undefined }));
                    }}
                    onSingleVenueChange={(venueId, venue) => {
                      setSingleVenue(venueId, venue);
                      setIsComplete(false);
                      if (errors.venue) setErrors((current) => ({ ...current, venue: undefined }));
                    }}
                    onParticipatingVenuesChange={(venues) => {
                      setParticipatingVenues(venues);
                      setIsComplete(false);
                      if (errors.venue) setErrors((current) => ({ ...current, venue: undefined }));
                    }}
                  />
                )}
              </div>

              {isComplete && (
                <div role="status" className="mt-7 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span><strong>Phase 1 complete.</strong> Your preview answers are ready to review. No event has been created.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:px-9 lg:px-12">
              <Button type="button" variant="ghost" onClick={handleBack} disabled={questionIndex === 0 || isTransitioning} className="min-h-[48px] !rounded-xl">
                <span className="inline-flex items-center gap-2"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back</span>
              </Button>
              <Button type="button" onClick={handleContinue} disabled={isTransitioning} className="min-h-[48px] min-w-[132px] !rounded-xl">
                <span className="inline-flex items-center gap-2">Continue<ArrowRight aria-hidden="true" className="h-4 w-4" /></span>
              </Button>
            </div>
          </section>

          <div className="hidden lg:block">
            <GuidedEventSummary variant="desktop" draft={draft} onEdit={handleSummaryEdit} />
          </div>
        </div>
      </div>
    </div>
  );
}
