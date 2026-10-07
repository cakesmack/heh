/**
 * Submit Event Page — Multi-Step Wizard
 * Renders the unified EventWizardForm component in creation mode.
 */

'use client';

import Head from 'next/head';
import { AuthGuard } from '@/components/common/AuthGuard';
import EventForm from '@/components/events/EventForm';

export default function SubmitEventPage() {
  return (
    <AuthGuard>
      <Head>
        <title>Submit an Event | Highland Events Hub</title>
        <meta name="description" content="Share your event with the Highland Events Hub community." />
      </Head>

      <EventForm isEditMode={false} />
    </AuthGuard>
  );
}
