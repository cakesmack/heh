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
import { useAuth, isApprovedSeller } from '@/hooks/useAuth';
import { api, apiFetch } from '@/lib/api';
import { Category, Organizer, EventResponse } from '@/types';
import { Button } from '@/components/common/Button';
import { toast } from 'react-hot-toast';
import {
  useEventWizard,
  WizardStepId,
  buildEventPayload,
  clearDraft,
} from '@/hooks/useEventWizard';

import StepBasicsComponent from '@/components/events/wizard/StepBasics';
import StepTimelineComponent from '@/components/events/wizard/StepTimeline';
import StepMediaComponent from '@/components/events/wizard/StepMedia';
import StepTicketsComponent from '@/components/events/wizard/StepTickets';
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
  steps,
  onStepClick,
}: {
  currentStep: WizardStepId;
  completedSteps: Set<WizardStepId>;
  steps: any[];
  onStepClick: (step: WizardStepId) => void;
}) {
  return (
    <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* Mobile: Compact bar with step count */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900">
              Step {currentStep} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {steps[currentStep - 1]?.label}
            </span>
          </div>
          {/* Progress track */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Desktop: Full step indicator */}
        <div className="hidden sm:flex items-center justify-between">
          {steps.map((step, index) => {
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
                {index < steps.length - 1 && (
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
  eventStatus: 'published' | 'pending_review' | 'pending' | 'pending_moderation';
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(newEventUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
      toast.success('Event link copied to clipboard!');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const isLive = eventStatus === 'published';

  const shareText = `Check out ${title} on Highland Events Hub!`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${newEventUrl}`)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(newEventUrl)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(newEventUrl)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => onClose(isLive ? `/events/${newEventId}` : '/account')}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isLive ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">Your event is live!</h2>
            <p className="text-gray-600 mb-5 text-sm">
              Your event is published and visible across maps, searches, and feeds.
            </p>

            {/* Public Link Box with Copy Button */}
            <div className="mb-5 p-3 bg-gray-50 rounded-2xl border border-gray-200 text-left flex items-center justify-between gap-2">
              <span className="text-xs text-gray-600 font-mono truncate flex-1 select-all">
                {newEventUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  shareCopied ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                {shareCopied ? '✓ Copied' : '📋 Copy Link'}
              </button>
            </div>

            {/* Social Share Links */}
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Share on Social Media</p>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors"
                >
                  <span>💬 WhatsApp</span>
                </a>
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 transition-colors"
                >
                  <span>📘 Facebook</span>
                </a>
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold border border-stone-200 transition-colors"
                >
                  <span>𝕏 Post</span>
                </a>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onClose(`/events/${newEventId}`)}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors min-h-[48px] shadow-sm cursor-pointer"
              >
                <span>View Live Event Page &rarr;</span>
              </button>

              <Link
                href={`/events/${newEventId}/promote`}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 rounded-xl font-semibold text-xs transition-colors"
              >
                <span>🚀 Boost Visibility: Feature at Top of Page</span>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Event Submitted for Review</h2>
            <p className="text-gray-700 text-sm mb-4 leading-relaxed font-medium">
              Your event has been submitted and is currently being reviewed by our moderation team.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              You will receive an email confirmation the moment your listing is approved and goes live.
            </p>
            <button
              type="button"
              onClick={() => onClose('/account')}
              className="w-full px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold min-h-[48px] cursor-pointer"
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
  const isAdmin = Boolean(user?.is_admin || (user as any)?.role === 'admin');
  const wizard = useEventWizard({ initialData, isEditMode, isAdmin });

  const {
    form,
    currentStep,
    steps,
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
  const [eventStatus, setEventStatus] = useState<'published' | 'pending_review' | 'pending' | 'pending_moderation'>('pending');

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
    // Run final validation on Step 4/5
    const errors = wizard.validateCurrentStep();
    if (errors) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const payload = buildEventPayload(form.getValues(), isAdmin);

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

        clearDraft();
        setNewEventId(newEvent.id);
        setNewEventUrl(publicUrl);
        setEventStatus(
          newEvent.status === 'published'
            ? 'published'
            : (newEvent.status === 'pending_review' || newEvent.status === 'pending_moderation' ? 'pending_review' : 'pending')
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
    // Determine the actual step name based on the current steps array
    const stepDef = wizard.steps.find((s) => s.id === currentStep);
    const stepLabel = stepDef ? stepDef.label : '';

    switch (stepLabel) {
      case 'Basics':
        return (
          <StepBasicsComponent
            form={form}
            categories={categories}
            organizers={organizers}
            user={user}
            stepErrors={stepErrors}
          />
        );
      case 'Timeline':
        return (
          <StepTimelineComponent
            form={form}
            stepErrors={stepErrors}
          />
        );
      case 'Media':
        return (
          <StepMediaComponent
            form={form}
            stepErrors={stepErrors}
          />
        );
      case 'Tickets':
        // Dynamically imported or standard component
        return (
          <StepTicketsComponent
            form={form}
            user={user}
            organizers={organizers}
            stepErrors={stepErrors}
          />
        );
      case 'Details':
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
        steps={steps}
        onStepClick={goToStep}
      />

      {/* ─── Page Header ────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          {isEditMode ? 'Edit Event' : 'Submit an Event'}
        </h1>
        <p className="text-base sm:text-lg text-gray-500 mt-2">
          {currentStep === 1 && (isEditMode ? 'Update event core details & location.' : "Let\u2019s start with the basics.")}
          {steps.find(s => s.id === currentStep)?.label === 'Timeline' && 'When is it happening?'}
          {steps.find(s => s.id === currentStep)?.label === 'Media' && 'Make it stand out with a great image.'}
          {steps.find(s => s.id === currentStep)?.label === 'Tickets' && 'Set up your ticketing options.'}
          {steps.find(s => s.id === currentStep)?.label === 'Details' && (isEditMode ? 'Review changes before saving.' : 'Final touches before publishing.')}
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
              {currentStep} / {steps.length}
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
