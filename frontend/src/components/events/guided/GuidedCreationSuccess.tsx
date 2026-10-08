import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Clock3 } from 'lucide-react';
import SocialShare from '@/components/common/SocialShare';
import type { EventResponse } from '@/types';

export function GuidedCreationSuccess({ event }: { event: EventResponse }) {
  const isPublished = event.status === 'published';
  const eventPath = `/events/${event.slug || event.id}`;
  const [shareUrl, setShareUrl] = useState('');
  useEffect(() => {
    setShareUrl(`${window.location.origin}${eventPath}`);
  }, [eventPath]);
  return <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-card sm:p-12" role="status">
    <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">{isPublished ? <Check aria-hidden="true" className="h-7 w-7" /> : <Clock3 aria-hidden="true" className="h-7 w-7" />}</span>
    <h1 className="text-3xl font-bold text-highland-green">{isPublished ? 'Your event is live!' : 'Event submitted for review'}</h1>
    <p className="mt-3 text-sm leading-6 text-gray-700">{isPublished ? 'Your event was created and published successfully.' : 'Your event was created and is awaiting moderation, as in the existing create-event flow.'}</p>
    <Link href={isPublished ? eventPath : '/account'} className="mt-7 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-highland-green px-6 py-3 text-sm font-bold text-white hover:bg-moss-green">{isPublished ? 'View live event' : 'Go to your dashboard'}</Link>
    {isPublished && <div className="mt-5 flex flex-col items-center gap-3">
      {shareUrl && <SocialShare url={shareUrl} title={event.title} description={`Check out ${event.title} on Highland Events Hub!`} />}
      <Link href={`/events/${event.id}/promote`} className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">Promote event — Boost visibility: Feature at top of page</Link>
    </div>}
  </div>;
}
