/**
 * Create Event Page
 * Alias for submit-event.tsx
 */

'use client';

import Head from 'next/head';
import { AuthGuard } from '@/components/common/AuthGuard';
import EventForm from '@/components/events/EventForm';

export default function CreateEventPage() {
  return (
    <AuthGuard>
      <Head>
        <title>Create an Event | Highland Events Hub</title>
        <meta name="description" content="List your event and sell tickets directly to Highland audiences." />
      </Head>

      <EventForm isEditMode={false} />
    </AuthGuard>
  );
}
