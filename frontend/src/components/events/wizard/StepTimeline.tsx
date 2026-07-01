/**
 * Step 2: Timeline
 * Card-based event type selection + EventScheduleSection integration.
 * 
 * Three large, tappable cards for:
 *  • One-Off Event (single date/time)
 *  • Recurring Event (weekly/biweekly/monthly/custom RRULE)
 *  • Multi-Session / Multiple Showings
 */

import React, { useState, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useEventWizard';
import EventScheduleSection from '@/components/events/form-sections/EventScheduleSection';
import { ShowtimeCreate } from '@/types';

type EventPattern = 'one-off' | 'recurring' | 'multi-session';

interface StepTimelineProps {
  form: UseFormReturn<WizardFormData>;
  stepErrors: Record<string, string> | null;
}

// ─── Pattern Selection Cards ───────────────────────────────
const PATTERN_OPTIONS: {
  id: EventPattern;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  example: string;
}[] = [
  {
    id: 'one-off',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'One-Off Event',
    subtitle: 'Happens once on a specific date',
    example: 'e.g. a festival, gig, or workshop',
  },
  {
    id: 'recurring',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    title: 'Recurring Event',
    subtitle: 'Repeats on a regular schedule',
    example: 'e.g. weekly pub quiz, monthly market',
  },
  {
    id: 'multi-session',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    title: 'Multiple Showings',
    subtitle: 'Same event, multiple specific times',
    example: 'e.g. theatre run, cinema screenings',
  },
];

export default function StepTimeline({ form, stepErrors }: StepTimelineProps) {
  const { watch, setValue, getValues } = form;
  const formData = watch();
  const errors = stepErrors || {};

  // ─── Derive initial pattern from formData (no circular ref) ─
  const derivePattern = (): EventPattern | null => {
    if (formData.isMultiSession) return 'multi-session';
    if (formData.is_recurring) return 'recurring';
    // If a date is already set, the user was previously on one-off
    if (formData.date_start) return 'one-off';
    return null;
  };

  const [selectedPattern, setSelectedPatternState] = useState<EventPattern | null>(derivePattern);

  // Synchronize top-level date_start and date_end for Multiple Showings (multi-session)
  React.useEffect(() => {
    if (formData.isMultiSession) {
      const showtimes = formData.showtimes || [];
      if (showtimes.length === 0) {
        setValue('date_start', '', { shouldValidate: true, shouldDirty: true });
        setValue('date_end', '', { shouldValidate: true, shouldDirty: true });
        return;
      }

      let earliestStart: Date | null = null;
      let latestEnd: Date | null = null;
      let earliestStartStr = '';
      let latestEndStr = '';

      showtimes.forEach((st) => {
        if (st.start_time) {
          const start = new Date(st.start_time);
          if (!isNaN(start.getTime())) {
            if (!earliestStart || start < earliestStart) {
              earliestStart = start;
              earliestStartStr = st.start_time;
            }
          }
        }
        if (st.end_time) {
          const end = new Date(st.end_time);
          if (!isNaN(end.getTime())) {
            if (!latestEnd || end > latestEnd) {
              latestEnd = end;
              latestEndStr = st.end_time;
            }
          }
        }
      });

      if (earliestStartStr) {
        setValue('date_start', earliestStartStr, { shouldValidate: true, shouldDirty: true });
      } else {
        setValue('date_start', '', { shouldValidate: true, shouldDirty: true });
      }

      if (latestEndStr) {
        setValue('date_end', latestEndStr, { shouldValidate: true, shouldDirty: true });
      } else {
        setValue('date_end', '', { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [formData.showtimes, formData.isMultiSession, setValue]);

  const selectPattern = useCallback((pattern: EventPattern) => {
    setSelectedPatternState(pattern);

    switch (pattern) {
      case 'one-off':
        setValue('is_recurring', false);
        setValue('isMultiSession', false);
        setValue('showtimes', []);
        break;
      case 'recurring':
        setValue('is_recurring', true);
        setValue('isMultiSession', false);
        setValue('showtimes', []);
        break;
      case 'multi-session':
        setValue('is_recurring', false);
        setValue('isMultiSession', true);
        break;
    }
  }, [setValue]);

  // ─── Adapter for EventScheduleSection ──────────────────
  // The existing component expects setFormData(fn) and handleChange(e).
  // We bridge it to react-hook-form here.
  const setFormDataAdapter = useCallback((updater: any) => {
    if (typeof updater === 'function') {
      const current = getValues();
      const next = updater(current);
      Object.keys(next).forEach((key) => {
        const k = key as keyof WizardFormData;
        if (JSON.stringify(next[k]) !== JSON.stringify(current[k])) {
          setValue(k, next[k]);
        }
      });
    } else {
      Object.keys(updater).forEach((key) => {
        setValue(key as keyof WizardFormData, updater[key]);
      });
    }
  }, [getValues, setValue]);

  const handleChangeAdapter = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setValue(
      name as keyof WizardFormData,
      type === 'checkbox' ? checked : value
    );
  }, [setValue]);

  const setShowtimesAdapter = useCallback((showtimes: ShowtimeCreate[]) => {
    setValue('showtimes', showtimes);
  }, [setValue]);

  const setIsMultiSessionAdapter = useCallback((v: boolean) => {
    setValue('isMultiSession', v);
  }, [setValue]);

  const setNoEndTimeAdapter = useCallback((v: boolean) => {
    setValue('noEndTime', v);
  }, [setValue]);

  const setIsAllDayAdapter = useCallback((v: boolean) => {
    setValue('is_all_day', v);
  }, [setValue]);

  return (
    <div className="space-y-8">
      {/* ─── Pattern Selection Cards ─────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">What type of event is this?</h3>
        <p className="text-sm text-gray-500 mb-5">Choose how your event is scheduled.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PATTERN_OPTIONS.map(option => {
            const isSelected = selectedPattern === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectPattern(option.id)}
                className={`
                  relative group text-left p-5 rounded-2xl border-2 transition-all duration-200 min-h-[140px]
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500
                  ${isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-100'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }
                `}
              >
                {/* Selected tick */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {/* Icon */}
                <div className={`mb-3 ${isSelected ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}>
                  {option.icon}
                </div>

                {/* Text */}
                <h4 className={`font-semibold text-base mb-1 ${isSelected ? 'text-emerald-800' : 'text-gray-800'}`}>
                  {option.title}
                </h4>
                <p className="text-sm text-gray-500 leading-snug">
                  {option.subtitle}
                </p>
                <p className="text-xs text-gray-400 mt-1.5 italic">
                  {option.example}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Schedule Form (Only shows after pattern selection) ── */}
      {selectedPattern && (
        <div className="animate-fadeIn">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-6" />

          {/* Wrap the existing EventScheduleSection but skip its outer FormSection layout */}
          <ScheduleFields
            formData={formData}
            setFormData={setFormDataAdapter}
            handleChange={handleChangeAdapter}
            isMultiSession={formData.isMultiSession}
            setIsMultiSession={setIsMultiSessionAdapter}
            showtimes={formData.showtimes || []}
            setShowtimes={setShowtimesAdapter}
            noEndTime={formData.noEndTime}
            setNoEndTime={setNoEndTimeAdapter}
            isAllDay={formData.is_all_day}
            setIsAllDay={setIsAllDayAdapter}
            fieldErrors={errors}
          />
        </div>
      )}

      {/* No pattern selected hint */}
      {!selectedPattern && (
        <p className="text-center text-sm text-gray-400 py-4">
          Select a pattern above to configure dates and times.
        </p>
      )}

      {/* Inline style for fadeIn animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// ─── Schedule Fields (inline wrapper around EventScheduleSection) ────
// This strips off the outer FormSection layout and renders just the fields.
function ScheduleFields(props: {
  formData: any;
  setFormData: (data: any) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  isMultiSession: boolean;
  setIsMultiSession: (v: boolean) => void;
  showtimes: ShowtimeCreate[];
  setShowtimes: (s: ShowtimeCreate[]) => void;
  noEndTime: boolean;
  setNoEndTime: (v: boolean) => void;
  isAllDay: boolean;
  setIsAllDay: (v: boolean) => void;
  fieldErrors: Record<string, string>;
}) {
  // We render the full EventScheduleSection here.
  // It comes wrapped in <FormSection> which adds the 3-column tip layout.
  // In the wizard context we let it render as-is since the wizard card
  // already provides the container. The tip section provides helpful info.
  return (
    <EventScheduleSection
      formData={props.formData}
      setFormData={props.setFormData}
      handleChange={props.handleChange}
      isMultiSession={props.isMultiSession}
      setIsMultiSession={props.setIsMultiSession}
      showtimes={props.showtimes}
      setShowtimes={props.setShowtimes}
      noEndTime={props.noEndTime}
      setNoEndTime={props.setNoEndTime}
      isAllDay={props.isAllDay}
      setIsAllDay={props.setIsAllDay}
      fieldErrors={props.fieldErrors}
    />
  );
}
