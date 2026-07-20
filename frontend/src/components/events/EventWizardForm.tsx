/**
 * EventWizardForm — Unified Multi-Step Event Creation & Edit Form Component
 *
 * Supports both creating new events (POST /api/events) and editing existing events (PUT /api/events/{id}).
 * Hydrates state cleanly from initialData and parses complex dates/showtimes/recurrence rules.
 */

import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, apiFetch } from '@/lib/api';
import { Category, Organizer, EventResponse } from '@/types';
import { Button } from '@/components/common/Button';
import { toast } from 'react-hot-toast';
import {
  useEventWizard,
  WIZARD_STEPS,
  WizardStepId,
  buildEventPayload,
  clearDraft,
} from '@/hooks/useEventWizard';

import StepBasicsComponent from '@/components/events/wizard/StepBasics';
import StepTimelineComponent from '@/components/events/wizard/StepTimeline';
import StepMediaComponent from '@/components/events/wizard/StepMedia';
import StepReviewComponent from '@/components/events/wizard/StepReview';

export interface EventWizardFormProps {
  initialData?: any;
  isEditMode?: boolean;
  eventId?: string;
  onSuccess?: (event: any) => void;
  onCancel?: () => void;
}

// ─── Progress Bar Component ────────────────────────────────
function WizardProgressBar({
  currentStep,
  completedSteps,
  onStepClick,
}: {
  currentStep: WizardStepId;
  completedSteps: Set<WizardStepId>;
  onStepClick: (step: WizardStepId) => void;
}) {
  return (
    <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* Mobile: Compact bar with step count */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900">
              Step {currentStep} of {WIZARD_STEPS.length}
            </span>
            <span className="text-sm text-gray-500">
              {WIZARD_STEPS[currentStep - 1].label}
            </span>
          </div>
          {/* Progress track */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / WIZARD_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Desktop: Full step indicator */}
        <div className="hidden sm:flex items-center justify-between">
          {WIZARD_STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = completedSteps.has(step.id);
            const isClickable = isCompleted || step.id <= currentStep;

            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-initial">
                {/* Step Circle + Label */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={`flex items-center gap-3 group transition-all duration-200 ${
                    isClickable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div
                    className={`relative flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all duration-300 ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted && !isActive ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{step.icon}</span>
                    )}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className={`text-sm font-semibold leading-tight ${
                      isActive ? 'text-emerald-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </p>
                  </div>
                </button>

                {/* Connector line */}
                {index < WIZARD_STEPS.length - 1 && (
                  <div className="flex-1 mx-3">
                    <div className="h-0.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isCompleted ? 'bg-emerald-400 w-full' : 'bg-transparent w-0'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Post-Submit Success Modal (Creation Mode) ───────────────
function PostSubmitModal({
  eventStatus,
  newEventId,
  newEventUrl,
  onClose,
  formData,
  categories,
}: {
  eventStatus: 'published' | 'pending' | 'pending_moderation';
  newEventId: string;
  newEventUrl: string;
  onClose: (navigateTo: string) => void;
  formData?: any;
  categories?: any[];
}) {
  const [shareCopied, setShareCopied] = useState(false);

  const localFormatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Upcoming Date';
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Upcoming Date';
    }
  };

  const category = categories?.find(c => c.id === formData?.category_id);
  const imageUrl = formData?.image_url;
  const title = formData?.title || 'Your Event';
  const price = formData?.price;
  const dateStart = formData?.date_start ? localFormatDate(formData.date_start) : 'Upcoming Date';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => onClose(eventStatus === 'published' ? `/events/${newEventId}` : '/account')}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {eventStatus === 'published' ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Your event is live!</h2>
            <p className="text-gray-600 mb-6 text-sm">Feature your event to get up to 5x more views.</p>

            {/* 16:9 Mockup Card */}
            <div className="mb-6 border border-stone-200 rounded-2xl overflow-hidden shadow-sm aspect-[16/9] relative bg-stone-100">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-teal-950" />
              )}
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/30 to-transparent" />

              {/* Badge */}
              <div className="absolute top-3 left-3 z-10">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-400 text-stone-950 uppercase tracking-wider shadow-sm animate-pulse">
                  ⚡ Promoted Mockup
                </span>
              </div>

              {/* Card Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-left text-white">
                {category && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider mb-1 inline-block px-1.5 py-0.5 rounded bg-white/10 backdrop-blur-sm"
                    style={{ color: category.gradient_color || '#10b981' }}
                  >
                    {category.name}
                  </span>
                )}
                <h3 className="text-sm sm:text-base font-bold line-clamp-1 leading-snug">
                  {title}
                </h3>
                <div className="flex items-center justify-between mt-1 text-[10px] text-stone-300">
                  <div>📅 {dateStart}</div>
                  <div className="font-bold text-amber-300">
                    {price === '0' || !price ? 'Free' : `£${parseFloat(price).toFixed(2)}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <Link
                href={`/events/${newEventId}/promote`}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl font-bold transition-colors min-h-[48px] shadow-sm"
              >
                🚀 Promote Your Event
              </Link>

              <button
                onClick={async () => {
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: title, url: newEventUrl });
                    } else {
                      await navigator.clipboard.writeText(newEventUrl);
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2500);
                    }
                  } catch (err: any) {
                    if (err?.name !== 'AbortError') {
                      await navigator.clipboard.writeText(newEventUrl);
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2500);
                    }
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-200 min-h-[48px] border border-stone-200 ${
                  shareCopied ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {shareCopied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Link Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share Event Link
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => onClose(`/events/${newEventId}`)}
              className="text-sm text-gray-500 hover:text-emerald-600 transition-colors"
            >
              Skip and view my event page &rarr;
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-5 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Event submitted for review.</h2>
            <p className="text-gray-600 mb-8">
              Your event is currently pending approval by our moderation team. You will receive an email the moment it goes live.
            </p>
            <button
              onClick={() => onClose('/account')}
              className="w-full px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium min-h-[48px]"
            >
              Got it, take me to my dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN EVENT WIZARD FORM COMPONENT ────────────────────────
export default function EventWizardForm({
  initialData,
  isEditMode = false,
  eventId,
  onSuccess,
  onCancel,
}: EventWizardFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const wizard = useEventWizard({ initialData, isEditMode });

  const {
    form,
    currentStep,
    direction,
    isAnimating,
    goNext,
    goBack,
    goToStep,
    stepErrors,
    clearWizard,
    isFirstStep,
    isLastStep,
    completedSteps,
  } = wizard;

  // Satellite state for data loading
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Post-submit modal state
  const [showPostSubmitModal, setShowPostSubmitModal] = useState(false);
  const [newEventUrl, setNewEventUrl] = useState('');
  const [newEventId, setNewEventId] = useState('');
  const [eventStatus, setEventStatus] = useState<'published' | 'pending' | 'pending_moderation'>('pending');

  // Load categories and organizers on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const catData = await api.categories.list();
        const cats = catData.categories || [];
        setCategories(cats);

        // Default category to first if not set and not in edit mode
        const currentCatId = form.getValues('category_id');
        if (!currentCatId && cats.length > 0 && !isEditMode) {
          form.setValue('category_id', cats[0].id);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }

      if (user) {
        try {
          const response = await apiFetch<any>(`/api/organizers?user_id=${user.id}`);
          const orgs = response.organizers || [];
          setOrganizers(orgs);

          const currentOrg = form.getValues('selectedOrganizer');
          if (currentOrg === null && !isEditMode) {
            if (orgs.length === 0) {
              form.setValue('selectedOrganizer', '');
            }
          }
        } catch (err) {
          console.error('Error fetching organizers:', err);
        }
      }

      setIsLoadingData(false);
    };

    fetchData();
  }, [user, isEditMode]);

  // Handle URL parameters for organizer profile ID if creating
  useEffect(() => {
    if (!isEditMode && router.isReady && router.query.organizer_profile_id) {
      const profileId = router.query.organizer_profile_id as string;
      form.setValue('organizer_profile_id', profileId);
      form.setValue('selectedOrganizer', profileId);
    }
  }, [router.isReady, router.query, isEditMode]);

  // ─── Final Submission (POST or PUT Branching) ──────────────
  const handleSubmit = useCallback(async () => {
    // Run final validation on Step 4
    const errors = wizard.validateCurrentStep();
    if (errors) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const payload = buildEventPayload(form.getValues());

      if (isEditMode && (eventId || initialData?.id)) {
        const targetId = eventId || initialData.id;
        const updatedEvent = await api.events.update(targetId, payload);
        toast.success('Event updated successfully!');

        if (onSuccess) {
          onSuccess(updatedEvent);
        } else {
          router.push(`/events/${targetId}`);
        }
      } else {
        const newEvent = await api.events.create(payload);

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const publicUrl = `${origin}/events/${newEvent.id}`;

        if (newEvent.status === 'published') {
          router.push(`/events/${newEvent.id}/promote-preview`);
          return;
        }

        clearDraft();
        setNewEventId(newEvent.id);
        setNewEventUrl(publicUrl);
        setEventStatus(
          newEvent.status === 'pending_moderation' ? 'pending_moderation' : 'pending'
        );
        setShowPostSubmitModal(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      if (err.status === 422 && err.detail) {
        const newFieldErrors: Record<string, string> = {};
        err.detail.forEach((error: any) => {
          const field = error.loc[error.loc.length - 1];
          let msg = error.msg;
          if (error.type === 'string_too_long') {
            const max = error.ctx?.limit_value || 255;
            msg = `This field is too long (Max ${max.toLocaleString()} characters).`;
          } else if (error.type === 'value_error.missing' || error.type === 'missing') {
            msg = 'This field is required.';
          }
          newFieldErrors[field] = msg;
        });
        setFieldErrors(newFieldErrors);
        setSubmitError('Please correct the highlighted errors below.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Failed to submit event.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  }, [form, wizard, isEditMode, eventId, initialData, onSuccess, router]);

  // Render Step Component
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepBasicsComponent
            form={form}
            categories={categories}
            organizers={organizers}
            user={user}
            stepErrors={stepErrors}
          />
        );
      case 2:
        return (
          <StepTimelineComponent
            form={form}
            stepErrors={stepErrors}
          />
        );
      case 3:
        return (
          <StepMediaComponent
            form={form}
            stepErrors={stepErrors}
          />
        );
      case 4:
        return (
          <StepReviewComponent
            form={form}
            categories={categories}
            stepErrors={stepErrors}
          />
        );
      default:
        return null;
    }
  };

  // Slide Animation Classes
  const getSlideClass = () => {
    if (isAnimating) {
      return direction === 'forward'
        ? 'translate-x-8 opacity-0'
        : '-translate-x-8 opacity-0';
    }
    return 'translate-x-0 opacity-100';
  };

  const cancelPath = isEditMode && (eventId || initialData?.id) ? `/events/${eventId || initialData.id}` : '/events';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* ─── Progress Bar (Sticky) ──────────────────────── */}
      <WizardProgressBar
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
      />

      {/* ─── Page Header ────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          {isEditMode ? 'Edit Event' : 'Submit an Event'}
        </h1>
        <p className="text-base sm:text-lg text-gray-500 mt-2">
          {currentStep === 1 && (isEditMode ? 'Update event core details & location.' : "Let\u2019s start with the basics.")}
          {currentStep === 2 && 'When is it happening?'}
          {currentStep === 3 && 'Make it stand out with a great image.'}
          {currentStep === 4 && (isEditMode ? 'Review changes before saving.' : 'Final touches before publishing.')}
        </p>
      </div>

      {/* ─── Error Banner ───────────────────────────────── */}
      {(submitError || stepErrors) && (
        <div className="max-w-3xl mx-auto px-4 mb-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              {submitError && <p className="font-medium">{submitError}</p>}
              {stepErrors && (
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(stepErrors).map(([field, msg]) => (
                    <li key={field} className="text-red-600">&bull; {msg}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Step Content (Animated) ────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-8">
            <div
              className={`transform transition-all duration-300 ease-out ${getSlideClass()}`}
            >
              {renderStep()}
            </div>
          </div>

          {/* ─── Navigation Footer ──────────────────────── */}
          <div className="px-5 sm:px-8 py-5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-4">
            {/* Back / Cancel */}
            <div>
              {isFirstStep ? (
                onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex items-center gap-2 px-5 py-3 text-gray-500 hover:text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors min-h-[48px]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                ) : (
                  <Link
                    href={cancelPath}
                    className="inline-flex items-center gap-2 px-5 py-3 text-gray-500 hover:text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors min-h-[48px]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </Link>
                )
              ) : (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isAnimating}
                  className="inline-flex items-center gap-2 px-5 py-3 text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-colors min-h-[48px] disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
            </div>

            {/* Step Counter (Mobile) */}
            <div className="sm:hidden text-xs text-gray-400 font-medium">
              {currentStep} / {WIZARD_STEPS.length}
            </div>

            {/* Next / Submit */}
            <div>
              {isLastStep ? (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting || isAnimating}
                  isLoading={isSubmitting}
                  onClick={handleSubmit}
                  className="min-w-[160px] min-h-[48px] !rounded-xl shadow-lg shadow-emerald-200/50"
                >
                  {isEditMode ? 'Save Changes' : 'Submit Event'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={isAnimating}
                  onClick={goNext}
                  className="min-w-[120px] min-h-[48px] !rounded-xl"
                >
                  Next
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Post Submit Modal for Creation Mode */}
      {showPostSubmitModal && (
        <PostSubmitModal
          eventStatus={eventStatus}
          newEventId={newEventId}
          newEventUrl={newEventUrl}
          onClose={(navigateTo) => {
            setShowPostSubmitModal(false);
            router.push(navigateTo);
          }}
          formData={form.getValues()}
          categories={categories}
        />
      )}
    </div>
  );
}
