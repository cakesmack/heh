import { useState } from 'react';
import TagInput from '@/components/tags/TagInput';
import type { GuidedEventDraft } from './guidedEventTypes';

const fieldClass = 'min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-stone-dark focus:border-moss-green focus:ring-2 focus:ring-moss-green/30';

interface Props {
  draft: GuidedEventDraft;
  error?: string;
  onChange: (patch: Partial<GuidedEventDraft>) => void;
}

export function FinishingQuestion({ draft, error, onChange }: Props) {
  const [imageIssue, setImageIssue] = useState<string | null>(null);
  const onFile = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setImageIssue('Choose a JPEG, PNG or WebP photo.'); return; }
    if (file.size > 20 * 1024 * 1024) { setImageIssue('Choose a photo smaller than 20 MB.'); return; }
    setImageIssue(null);
    onChange({ imageName: file.name, imagePreviewUrl: URL.createObjectURL(file) });
  };
  return <div className="space-y-8">
    <div className="space-y-3">
      <label htmlFor="guided-photo" className="block text-sm font-semibold text-gray-800">Event photo <span className="font-normal text-gray-500">(optional)</span></label>
      <input id="guided-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFile(event.target.files?.[0])} className="block w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:font-semibold file:text-emerald-800" />
      <p className="text-sm text-gray-600">Your photo stays in this browser preview. It is not uploaded or saved to an event.</p>
      {imageIssue && <p role="alert" className="text-sm font-semibold text-red-700">{imageIssue}</p>}
      {draft.imagePreviewUrl && <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"><img src={draft.imagePreviewUrl} alt="Selected event photo preview" className="max-h-72 w-full object-cover" /><div className="flex items-center justify-between gap-3 p-3 text-sm"><span className="min-w-0 truncate text-gray-700">{draft.imageName}</span><button type="button" onClick={() => onChange({ imageName: '', imagePreviewUrl: '' })} className="font-bold text-red-700 hover:underline">Remove photo</button></div></div>}
    </div>
    <TagInput selectedTags={draft.tags} onChange={(tags) => onChange({ tags })} maxTags={5} />
    <div><label htmlFor="guided-age" className="mb-2 block text-sm font-semibold text-gray-800">Age restriction</label><select id="guided-age" value={draft.ageRestriction} onChange={(event) => onChange({ ageRestriction: event.target.value })} className={fieldClass}><option value="">All ages welcome</option>{['5+', '12+', '14+', '16+', '18+', '21+'].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
    <div><label htmlFor="guided-website" className="mb-2 block text-sm font-semibold text-gray-800">Event website <span className="font-normal text-gray-500">(optional)</span></label><input id="guided-website" type="url" inputMode="url" value={draft.websiteUrl} onChange={(event) => onChange({ websiteUrl: event.target.value })} placeholder="https://example.com" className={fieldClass} /></div>
    {draft.attendanceMode === 'external' && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">External booking link is set in “How can people attend?” so it remains distinct from the optional event website.</p>}
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
