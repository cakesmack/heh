import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import OrganizerSelector from '@/components/events/OrganizerSelector';
import type { Category, Organizer } from '@/types';
import type { GuidedEventDraft } from './guidedEventTypes';

const RichTextEditor = dynamic(() => import('@/components/common/RichTextEditor'), { ssr: false });

interface Props {
  draft: GuidedEventDraft;
  error?: string;
  onChange: (patch: Partial<GuidedEventDraft>) => void;
}

export function DetailsQuestion({ draft, error, onChange }: Props) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [categoryIssue, setCategoryIssue] = useState(false);
  useEffect(() => {
    if (user && !draft.organizerId && !draft.organizerName) onChange({ organizerName: user.username || user.email || 'Personal profile' });
  }, [user, draft.organizerId, draft.organizerName, onChange]);
  useEffect(() => {
    let cancelled = false;
    api.categories.list().then((result) => { if (!cancelled) setCategories(result.categories || []); }).catch(() => { if (!cancelled) setCategoryIssue(true); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    api.organizers.list({ user_id: user.id }).then((result) => { if (!cancelled) setOrganizers(result.organizers || []); }).catch(() => { if (!cancelled) setOrganizers([]); });
    return () => { cancelled = true; };
  }, [user?.id]);
  return <div className="space-y-8">
    <div>
      <label htmlFor="guided-category" className="mb-2 block text-sm font-semibold text-gray-800">Category *</label>
      <select id="guided-category" value={draft.categoryId} onChange={(event) => onChange({ categoryId: event.target.value, categoryName: categories.find((category) => category.id === event.target.value)?.name || '' })} className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-stone-dark focus:border-moss-green focus:ring-2 focus:ring-moss-green/30">
        <option value="">Select a category</option>{draft.categoryId && !categories.some((category) => category.id === draft.categoryId) && <option value={draft.categoryId}>{draft.categoryName || 'Current category'}</option>}{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
      {categoryIssue && <p className="mt-2 text-sm text-amber-800" role="status">Categories could not be loaded. Check that the local API is available.</p>}
    </div>
    {draft.organizerId && !organizers.some((organizer) => organizer.id === draft.organizerId) && <p className="text-sm text-highland-green">Current host: {draft.organizerName || 'Selected organisation'}. This host is preserved unless you choose another.</p>}
    {user && <OrganizerSelector user={user} organizers={organizers} selectedId={draft.organizerId} onChange={(organizerId) => onChange({ organizerId, organizerName: organizers.find((organizer) => organizer.id === organizerId)?.name || user.username || user.email || 'Personal profile' })} />}
    {!user && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Sign in to choose who hosts this event. An event is created only when you submit.</p>}
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-800">Description</label>
      <p className="mb-3 text-sm text-gray-600">What should visitors expect? This field is optional in the existing form.</p>
      <RichTextEditor value={draft.description} onChange={(description) => onChange({ description })} placeholder="Describe your event…" maxLength={20000} />
    </div>
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
