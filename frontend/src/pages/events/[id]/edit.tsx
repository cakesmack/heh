/**
 * Edit Event Page
 * Uses the unified EventWizardForm component initialized with event initialData in Edit Mode.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { EventResponse } from '@/types';
import { AuthGuard } from '@/components/common/AuthGuard';
import { Spinner } from '@/components/common/Spinner';
import EventWizardForm from '@/components/events/EventWizardForm';

export default function EditEventPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [eventData, setEventData] = useState<EventResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady || !id) return;

    const fetchEvent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.events.get(id as string);
        setEventData(data);
      } catch (err: any) {
        console.error('Error fetching event for edit:', err);
        setError(err instanceof Error ? err.message : 'Failed to load event data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [router.isReady, id]);

  if (authLoading || (isLoading && !error)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4 text-emerald-600" />
          <p className="text-gray-600 font-medium">Loading event details for editing...</p>
        </div>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm text-center border border-gray-200">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Edit Event</h1>
          <p className="text-sm text-gray-600 mb-6">{error || 'Event not found or failed to load.'}</p>
          <Link
            href="/account"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <Head>
        <title>Edit {eventData.title || 'Event'} | Highland Events Hub</title>
      </Head>

      <EventWizardForm
        initialData={eventData}
        isEditMode={true}
        eventId={eventData.id}
      />
    </AuthGuard>
  );
}
