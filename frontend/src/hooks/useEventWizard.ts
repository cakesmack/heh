/**
 * useEventWizard — State management hook for the multi-step event submission wizard.
 *
 * Architecture:
 * - react-hook-form for per-field validation & dirty tracking
 * - sessionStorage persistence (auto-save on every change, restore on mount)
 * - Per-step validation schemas before allowing "Next"
 * - Clean API payload builder that mirrors the existing EventCreate contract
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { VenueResponse, ShowtimeCreate, Category, Organizer } from '@/types';

// ─── Storage Key ───────────────────────────────────────────
const STORAGE_KEY = 'heh_event_wizard_draft';

// ─── Wizard Step Definitions ───────────────────────────────
export interface WizardStep {
  id: number;
  label: string;
  icon: string;
  shortLabel: string;
}

export const getWizardSteps = (isTicketingEnabled: boolean): WizardStep[] => {
  const steps: WizardStep[] = [
    { id: 1, label: 'Basics',   icon: '📋', shortLabel: 'Basics' },
    { id: 2, label: 'Timeline', icon: '📅', shortLabel: 'When' },
    { id: 3, label: 'Media',    icon: '📸', shortLabel: 'Media' },
  ];
  if (isTicketingEnabled) {
    steps.push({ id: 4, label: 'Tickets', icon: '🎟️', shortLabel: 'Tickets' });
    steps.push({ id: 5, label: 'Details', icon: '✨', shortLabel: 'Review' });
  } else {
    steps.push({ id: 4, label: 'Details', icon: '✨', shortLabel: 'Review' });
  }
  return steps;
};

export type WizardStepId = 1 | 2 | 3 | 4 | 5;

// ─── Form Data Shape ───────────────────────────────────────
// This is the unified form state across all wizard steps.
// It maps 1:1 to the fields used in the current submit-event.tsx.
export interface TicketTierCreate {
  name: string;
  price: number;
  quantity_available: number;
  max_per_order: number;
}

export interface WizardFormData {
  // Step 1: Core Info & Location
  title: string;
  category_id: string;
  price: string;
  organizer_profile_id: string;  // '' = Myself, 'uuid' = Group
  selectedOrganizer: string | null; // null = not yet chosen (validation gate)
  venue_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  postcode: string;
  address: string;
  locationTab: 'main' | 'multi';
  locationMode: 'venue' | 'custom';
  participating_venue_ids: string[];
  map_display_lat: number | null;
  map_display_lng: number | null;
  map_display_label: string;

  // Step 2: Timeline
  date_start: string;
  date_end: string;
  is_all_day: boolean;
  is_recurring: boolean;
  frequency: string;
  recurrence_end_date: string;
  ends_on: string;
  weekdays: number[];
  recurrence_rule: string;
  isMultiSession: boolean;
  noEndTime: boolean;
  showtimes: ShowtimeCreate[];

  // Step 3: Media
  image_url: string;

  // Optional Tickets Step
  is_ticketing_enabled: boolean;
  pass_fees_to_buyer: boolean;
  ticket_tiers: TicketTierCreate[];

  // Step 4/5: Details & Review
  description: string;
  ticket_url: string;
  website_url: string;
  age_restriction: string;
  tags: string[];
}

// ─── Default Values ────────────────────────────────────────
export const WIZARD_DEFAULTS: WizardFormData = {
  // Step 1
  title: '',
  category_id: '',
  price: '0',
  organizer_profile_id: '',
  selectedOrganizer: null,
  venue_id: '',
  location_name: '',
  latitude: 57.4778,
  longitude: -4.2247,
  postcode: '',
  address: '',
  locationTab: 'main',
  locationMode: 'venue',
  participating_venue_ids: [],
  map_display_lat: null,
  map_display_lng: null,
  map_display_label: '',

  // Step 2
  date_start: '',
  date_end: '',
  is_all_day: false,
  is_recurring: false,
  frequency: 'WEEKLY',
  recurrence_end_date: '',
  ends_on: 'never',
  weekdays: [],
  recurrence_rule: '',
  isMultiSession: false,
  noEndTime: false,
  showtimes: [],

  // Step 3
  image_url: '',

  // Optional Tickets Step
  is_ticketing_enabled: false,
  pass_fees_to_buyer: false,
  ticket_tiers: [],

  // Step 4/5
  description: '',
  ticket_url: '',
  website_url: '',
  age_restriction: '',
  tags: [],
};

// ─── Per-Step Validation Rules ─────────────────────────────
// Returns an error message string, or null if valid.
type StepValidator = (data: WizardFormData) => Record<string, string> | null;

const validateStep1: StepValidator = (data) => {
  const errors: Record<string, string> = {};

  if (data.selectedOrganizer === null) {
    errors.selectedOrganizer = 'Please select who is hosting this event.';
  }
  if (!data.title.trim()) {
    errors.title = 'Event title is required.';
  }
  if (data.title.length > 255) {
    errors.title = 'Title must be 255 characters or less.';
  }
  if (!data.category_id) {
    errors.category_id = 'Please select a category.';
  }
  if (data.locationTab === 'main' && !data.venue_id && !data.location_name) {
    errors.venue_id = 'Please select a venue or enter a location.';
  }
  if (data.locationTab === 'multi' && data.participating_venue_ids.length === 0) {
    errors.participating_venue_ids = 'Please add at least one participating venue.';
  }
  return Object.keys(errors).length > 0 ? errors : null;
};

const validateStep2: StepValidator = (data) => {
  const errors: Record<string, string> = {};

  if (!data.date_start) {
    errors.date_start = 'Start date is required.';
  }

  if (!data.noEndTime && !data.isMultiSession) {
    if (!data.date_end) {
      errors.date_end = 'End date is required.';
    } else if (new Date(data.date_end) <= new Date(data.date_start)) {
      errors.date_end = 'End date must be after start date.';
    }
  }
  if (data.isMultiSession && data.showtimes.length === 0) {
    errors.showtimes = 'Please add at least one showtime.';
  }
  return Object.keys(errors).length > 0 ? errors : null;
};

const validateStep3: StepValidator = () => {
  // Image is optional (user can skip)
  return null;
};

const validateTickets: StepValidator = (data) => {
  const errors: Record<string, string> = {};
  if (data.is_ticketing_enabled) {
    if (data.ticket_tiers.length === 0) {
      errors.ticket_tiers = 'Please add at least one ticket tier.';
    }
    data.ticket_tiers.forEach((tier, index) => {
      if (!tier.name.trim()) errors[`ticket_tiers.${index}.name`] = 'Tier name is required.';
      if (tier.quantity_available <= 0) errors[`ticket_tiers.${index}.quantity_available`] = 'Capacity must be greater than 0.';
    });
  }
  return Object.keys(errors).length > 0 ? errors : null;
};

const validateReview: StepValidator = () => {
  // Description and links are optional
  return null;
};

export const getStepValidator = (stepId: number, isTicketingEnabled: boolean): StepValidator => {
  if (stepId === 1) return validateStep1;
  if (stepId === 2) return validateStep2;
  if (stepId === 3) return validateStep3;
  if (isTicketingEnabled) {
    if (stepId === 4) return validateTickets;
    if (stepId === 5) return validateReview;
  } else {
    if (stepId === 4) return validateReview;
  }
  return () => null;
};

// ─── sessionStorage Persistence ────────────────────────────
function saveDraft(data: WizardFormData, currentStep: WizardStepId): void {
  try {
    const payload = JSON.stringify({ data, currentStep, savedAt: Date.now() });
    sessionStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // Silently fail (e.g. private browsing, quota exceeded)
  }
}

function loadDraft(): { data: WizardFormData; currentStep: WizardStepId } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire drafts older than 4 hours
    if (Date.now() - parsed.savedAt > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { data: parsed.data, currentStep: parsed.currentStep };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// ─── API Payload Builder ───────────────────────────────────
// Transforms wizard state into the exact JSON the backend expects.
export function buildEventPayload(data: WizardFormData, isAdmin: boolean = true) {
  // Calculate dates for multi-session events
  let calculatedDateStart = data.date_start;
  let calculatedDateEnd = data.date_end;
  let showtimesPayload: ShowtimeCreate[] | undefined = undefined;

  if (data.isMultiSession && data.showtimes.length > 0) {
    const startTimes = data.showtimes.map(st => new Date(st.start_time).getTime());
    const endTimes = data.showtimes.map(st =>
      st.end_time ? new Date(st.end_time).getTime() : new Date(st.start_time).getTime()
    );
    calculatedDateStart = new Date(Math.min(...startTimes)).toISOString();
    calculatedDateEnd = new Date(Math.max(...endTimes)).toISOString();
    showtimesPayload = data.showtimes;
  } else {
    calculatedDateStart = new Date(data.date_start).toISOString();
    if (data.noEndTime) {
      const startDate = new Date(data.date_start);
      calculatedDateEnd = new Date(startDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
    } else {
      calculatedDateEnd = new Date(data.date_end).toISOString();
    }
  }

  const ticketingAllowed = Boolean(isAdmin && data.is_ticketing_enabled);

  return {
    title: data.title,
    description: data.description || undefined,
    category_id: data.category_id,
    venue_id: data.locationTab === 'main' ? (data.venue_id || null) : null,
    location_name: (data.locationTab === 'main' && data.locationMode === 'custom') ? data.location_name : null,
    latitude: (data.locationTab === 'main' && data.locationMode === 'custom') ? data.latitude : null,
    longitude: (data.locationTab === 'main' && data.locationMode === 'custom') ? data.longitude : null,
    date_start: calculatedDateStart,
    date_end: calculatedDateEnd,
    price: data.price,
    image_url: data.image_url || undefined,
    is_ticketing_enabled: ticketingAllowed,
    pass_fees_to_buyer: ticketingAllowed ? data.pass_fees_to_buyer : false,
    ticket_tiers: ticketingAllowed ? data.ticket_tiers : undefined,
    ticket_url: data.ticket_url || undefined,
    website_url: data.website_url || undefined,
    is_all_day: data.is_all_day,
    age_restriction: data.age_restriction || undefined,
    tags: data.tags.length > 0 ? data.tags : undefined,
    organizer_profile_id: data.selectedOrganizer || undefined,
    is_recurring: data.is_recurring,
    recurrence_rule: (data.is_recurring && data.frequency === 'CUSTOM') ? data.recurrence_rule : undefined,
    frequency: data.is_recurring ? data.frequency : undefined,
    recurrence_end_date: (data.is_recurring && data.ends_on === 'date')
      ? new Date(data.recurrence_end_date).toISOString()
      : undefined,
    weekdays: data.is_recurring && data.weekdays.length > 0 ? data.weekdays : undefined,
    participating_venue_ids: data.participating_venue_ids.length > 0 ? data.participating_venue_ids : undefined,
    showtimes: showtimesPayload,
    map_display_lat: data.map_display_lat,
    map_display_lng: data.map_display_lng,
    map_display_label: data.map_display_label || undefined,
  };
}

export const formatDateForInput = (isoString: string | Date | undefined | null): string => {
  if (!isoString) return '';
  if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(isoString)) {
    return isoString;
  }
  let date: Date;
  if (typeof isoString === 'string') {
    const localStr = isoString.endsWith('Z') ? isoString.slice(0, -1) : isoString;
    date = new Date(localStr);
  } else {
    date = isoString;
  }
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function parseInitialEventData(data: any): WizardFormData {
  if (!data) return WIZARD_DEFAULTS;

  const showtimes: ShowtimeCreate[] = Array.isArray(data.showtimes) ? data.showtimes.map((st: any) => ({
    id: st.id,
    start_time: formatDateForInput(st.start_time),
    end_time: st.end_time ? formatDateForInput(st.end_time) : '',
    ticket_url: st.ticket_url || '',
    notes: st.notes || '',
  })) : [];

  const isMultiSession = showtimes.length > 0;
  const isRecurring = Boolean(data.is_recurring || data.recurrence_rule);

  const participatingVenueIds = data.participating_venues
    ? data.participating_venues.map((v: any) => v.id)
    : (data.participating_venue_ids || []);

  const locationTab = participatingVenueIds.length > 0 ? 'multi' : 'main';
  const venueId = data.venue_id || data.venue?.id || '';
  const locationMode = venueId ? 'venue' : 'custom';

  const categoryId = data.category_id || data.category?.id || '';
  const organizerId = data.organizer_profile_id || data.organizer_profile?.id || '';

  const tags = Array.isArray(data.tags)
    ? data.tags.map((t: any) => (typeof t === 'string' ? t : t.name || String(t)))
    : [];

  return {
    title: data.title || '',
    category_id: categoryId,
    price: data.price !== undefined && data.price !== null ? String(data.price) : '0',
    organizer_profile_id: organizerId,
    selectedOrganizer: organizerId || null,
    venue_id: venueId,
    location_name: data.location_name || '',
    latitude: data.latitude ?? 57.4778,
    longitude: data.longitude ?? -4.2247,
    postcode: data.postcode || '',
    address: data.address || '',
    locationTab: locationTab,
    locationMode: locationMode,
    participating_venue_ids: participatingVenueIds,
    map_display_lat: data.map_display_lat ?? null,
    map_display_lng: data.map_display_lng ?? null,
    map_display_label: data.map_display_label || '',

    date_start: formatDateForInput(data.date_start),
    date_end: formatDateForInput(data.date_end),
    is_all_day: Boolean(data.is_all_day),
    is_recurring: isRecurring,
    frequency: data.frequency || (data.recurrence_rule ? 'CUSTOM' : 'WEEKLY'),
    recurrence_end_date: formatDateForInput(data.recurrence_end_date),
    ends_on: data.recurrence_end_date ? 'date' : 'never',
    weekdays: data.weekdays || [],
    recurrence_rule: data.recurrence_rule || '',
    isMultiSession: isMultiSession,
    noEndTime: !data.date_end,
    showtimes: showtimes,

    image_url: data.image_url || '',
    is_ticketing_enabled: Boolean(data.is_ticketing_enabled),
    pass_fees_to_buyer: Boolean(data.pass_fees_to_buyer),
    ticket_tiers: data.ticket_tiers || [],

    description: data.description || '',
    ticket_url: data.ticket_url || '',
    website_url: data.website_url || '',
    age_restriction: data.age_restriction || '',
    tags: tags,
  };
}

// ─── The Hook ──────────────────────────────────────────────
export interface UseEventWizardOptions {
  initialData?: any;
  isEditMode?: boolean;
  isAdmin?: boolean;
}

export interface UseEventWizardReturn {
  form: UseFormReturn<WizardFormData>;
  currentStep: WizardStepId;
  steps: WizardStep[];
  stepErrors: Record<string, string> | null;
  direction: 'forward' | 'backward';
  isAnimating: boolean;
  goNext: () => boolean;
  goBack: () => void;
  goToStep: (step: WizardStepId) => void;
  validateCurrentStep: () => Record<string, string> | null;
  clearWizard: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  completedSteps: Set<WizardStepId>;
}

export function useEventWizard(options: UseEventWizardOptions = {}): UseEventWizardReturn {
  const { initialData, isEditMode = false, isAdmin = false } = options;

  const getInitialValues = useCallback(() => {
    if (isEditMode && initialData) {
      return parseInitialEventData(initialData);
    }
    const draft = loadDraft();
    return draft?.data ?? WIZARD_DEFAULTS;
  }, [isEditMode, initialData]);

  const form = useForm<WizardFormData>({
    defaultValues: getInitialValues(),
    mode: 'onSubmit', // Validate on submit/next only
  });

  const { watch, getValues, setValue, reset } = form;

  // Reset form when initialData updates asynchronously in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      const parsed = parseInitialEventData(initialData);
      reset(parsed);
    }
  }, [isEditMode, initialData, reset]);

  // Track current step, direction, animation, and completed steps
  const [currentStep, setCurrentStep] = useState<WizardStepId>(() => {
    if (isEditMode) return 1;
    const draft = loadDraft();
    return draft?.currentStep ?? 1;
  });
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isAnimating, setIsAnimating] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string> | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStepId>>(new Set());

  // Auto-save to sessionStorage on every form change (debounced) - skip if in edit mode
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isEditMode) return;
    const subscription = watch(() => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveDraft(getValues(), currentStep);
      }, 500);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isEditMode, watch, getValues, currentStep]);

  // Also save step changes if not edit mode
  useEffect(() => {
    if (!isEditMode) {
      saveDraft(getValues(), currentStep);
    }
  }, [isEditMode, currentStep]);

  const isTicketingEnabled = Boolean(isAdmin && watch('is_ticketing_enabled'));
  const steps = getWizardSteps(isTicketingEnabled);

  const validateCurrentStep = useCallback((): Record<string, string> | null => {
    const validator = getStepValidator(currentStep, isTicketingEnabled);
    const errors = validator(getValues());
    setStepErrors(errors);
    return errors;
  }, [currentStep, getValues, isTicketingEnabled]);

  const goNext = useCallback((): boolean => {
    const errors = validateCurrentStep();
    if (errors) return false;

    // Mark current step as completed
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    setStepErrors(null);

    if (currentStep < steps.length) {
      setDirection('forward');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((currentStep + 1) as WizardStepId);
        setIsAnimating(false);
        // Scroll to top of form
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300);
    }
    return true;
  }, [currentStep, validateCurrentStep]);

  const goBack = useCallback(() => {
    setStepErrors(null);
    if (currentStep > 1) {
      setDirection('backward');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((currentStep - 1) as WizardStepId);
        setIsAnimating(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: WizardStepId) => {
    // Only allow jumping to completed steps or the next available step
    const maxAllowed = Math.max(...Array.from(completedSteps), 0) + 1;
    if (step <= maxAllowed || step <= currentStep) {
      setDirection(step > currentStep ? 'forward' : 'backward');
      setStepErrors(null);
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(step);
        setIsAnimating(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300);
    }
  }, [currentStep, completedSteps]);

  const clearWizard = useCallback(() => {
    clearDraft();
    reset(WIZARD_DEFAULTS);
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setStepErrors(null);
  }, [reset]);

  return {
    form,
    currentStep,
    steps,
    stepErrors,
    direction,
    isAnimating,
    goNext,
    goBack,
    goToStep,
    validateCurrentStep,
    clearWizard,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === steps.length,
    completedSteps,
  };
}

