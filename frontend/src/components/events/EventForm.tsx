import type { EventResponse } from '@/types';
import EventWizardForm from './EventWizardForm';
import GuidedEventForm from './guided/GuidedEventFormPreview';

/** Rollback: set NEXT_PUBLIC_USE_LEGACY_EVENT_FORM=true and rebuild. */
export default function EventForm(props: { initialData?: EventResponse; isEditMode?: boolean; eventId?: string }) {
  return process.env.NEXT_PUBLIC_USE_LEGACY_EVENT_FORM === 'true'
    ? <EventWizardForm {...props} />
    : <GuidedEventForm key={props.eventId || 'create'} {...props} />;
}
