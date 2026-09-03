/**
 * Step 4: Details & Review
 * Description (RichTextEditor), Tags, Ticket/Website URLs, Age Restriction
 * + Live Preview using the real EventCard component.
 */

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useEventWizard';
import { Input } from '@/components/common/Input';
import TagInput from '@/components/tags/TagInput';
import { EventCard } from '@/components/events/EventCard';
import { EventResponse, Category, Showtime } from '@/types';
import { normalizeUrl } from '@/utils/url';

// Dynamic import — RichTextEditor uses Tiptap which requires browser APIs
const RichTextEditor = dynamic(
  () => import('@/components/common/RichTextEditor'),
  { ssr: false, loading: () => <div className="border border-gray-300 rounded-lg bg-gray-50 min-h-[150px] animate-pulse p-3">Loading editor...</div> }
);

interface StepReviewProps {
  form: UseFormReturn<WizardFormData>;
  categories: Category[];
  stepErrors: Record<string, string> | null;
}

export default function StepReview({ form, categories, stepErrors }: StepReviewProps) {
  const { watch, setValue, getValues } = form;
  const formData = watch();
  const errors = stepErrors || {};

  // Build a mock EventResponse for the live preview
  const previewEvent = useMemo(() => {
    const now = new Date().toISOString();
    const category = categories.find(c => c.id === formData.category_id);

    // Build showtimes for preview
    const previewShowtimes: Showtime[] = (formData.showtimes || []).map((st, i) => ({
      id: i,
      event_id: 'preview',
      start_time: st.start_time,
      end_time: st.end_time,
      ticket_url: st.ticket_url,
      notes: st.notes,
    }));

    // Parse price for numeric display
    const priceStr = formData.price || '0';
    const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
    const isFree = priceStr.toLowerCase() === 'free' || priceStr === '0' || priceStr === '';

    return {
      id: 'preview-draft',
      title: formData.title || 'Untitled Event',
      description: formData.description || undefined,
      date_start: formData.date_start || now,
      date_end: formData.date_end || formData.date_start || now,
      venue_id: formData.venue_id || '',
      venue_name: formData.location_name || undefined,
      latitude: formData.latitude,
      longitude: formData.longitude,
      category_id: formData.category_id || undefined,
      category: category || undefined,
      price: isFree ? 0 : numericPrice,
      price_display: isFree ? 'Free' : formData.price,
      image_url: formData.image_url || undefined,
      featured: false,
      organizer_id: '',
      created_at: now,
      updated_at: now,
      is_recurring: formData.is_recurring,
      is_all_day: formData.is_all_day,
      ticket_url: formData.ticket_url || undefined,
      website_url: formData.website_url || undefined,
      age_restriction: formData.age_restriction || undefined,
      showtimes: previewShowtimes.length > 0 ? previewShowtimes : undefined,
      tags: formData.tags?.map(t => ({ id: t, name: t, usage_count: 0, created_at: '' })),
      checkin_count: 0,
      slug: 'preview',
    } as EventResponse;
  }, [
    formData.title, formData.description, formData.date_start, formData.date_end,
    formData.venue_id, formData.location_name, formData.latitude, formData.longitude,
    formData.category_id, formData.price, formData.image_url, formData.is_recurring,
    formData.is_all_day, formData.ticket_url, formData.website_url, formData.age_restriction,
    formData.showtimes, formData.tags, categories,
  ]);

  return (
    <div className="space-y-8">
      {/* ─── Description (Rich Text) ──────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <p className="text-xs text-gray-400 mb-3">Add details about your event. What should attendees expect?</p>
        <RichTextEditor
          value={formData.description}
          onChange={(val: string) => setValue('description', val)}
          placeholder="Describe your event — what can attendees expect?"
          maxLength={20000}
        />
      </div>

      {/* ─── Ticket URL ───────────────────────────────── */}
      <div>
        <Input
          name="ticket_url"
          label="Ticket / Booking URL"
          type="url"
          value={formData.ticket_url}
          onChange={(e) => setValue('ticket_url', e.target.value)}
          onBlur={() => setValue('ticket_url', normalizeUrl(formData.ticket_url || ''))}
          placeholder="e.g. eventbrite.co.uk/my-event"
          helperText="Where can people buy tickets or register?"
          className="!py-3"
        />
      </div>

      {/* ─── Website URL ──────────────────────────────── */}
      <div>
        <Input
          name="website_url"
          label="Event Website"
          type="url"
          value={formData.website_url}
          onChange={(e) => setValue('website_url', e.target.value)}
          onBlur={() => setValue('website_url', normalizeUrl(formData.website_url || ''))}
          placeholder="e.g. myevent.co.uk"
          helperText="Optional link to your event page or organisation website."
          className="!py-3"
        />
      </div>

      {/* ─── Age Restriction ──────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Age Restriction</label>
        <select
          name="age_restriction"
          value={formData.age_restriction}
          onChange={(e) => setValue('age_restriction', e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[48px]"
        >
          <option value="">All ages welcome</option>
          <option value="5+">5+</option>
          <option value="12+">12+</option>
          <option value="14+">14+</option>
          <option value="16+">16+</option>
          <option value="18+">18+ only</option>
          <option value="21+">21+ only</option>
        </select>
      </div>

      {/* ─── Tags ─────────────────────────────────────── */}
      <div>
        <TagInput
          selectedTags={formData.tags || []}
          onChange={(tags) => setValue('tags', tags)}
          maxTags={5}
        />
      </div>

      {/* ─── Divider ──────────────────────────────────── */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-4 text-gray-400 font-medium tracking-wider">Live Preview</span>
        </div>
      </div>

      {/* ─── Live Preview ─────────────────────────────── */}
      <div>
        <p className="text-sm text-gray-500 mb-4 text-center">
          This is how your event will appear on the platform.
        </p>
        <div className="max-w-sm mx-auto">
          {/* Render the exact EventCard used everywhere on the site */}
          <div className="pointer-events-none select-none">
            <EventCard event={previewEvent} />
          </div>
        </div>
      </div>

      {/* ─── Final Summary ─────────────────────────────── */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Submission summary</h4>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-gray-500">Title</dt>
            <dd className="font-medium text-gray-900 text-right max-w-[60%] truncate">{formData.title || '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Date</dt>
            <dd className="font-medium text-gray-900">
              {formData.date_start
                ? new Date(formData.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'
              }
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Venue</dt>
            <dd className="font-medium text-gray-900 text-right max-w-[60%] truncate">{formData.location_name || '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Price</dt>
            <dd className="font-medium text-gray-900">{formData.price || 'Free'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Image</dt>
            <dd className="font-medium text-gray-900">{formData.image_url ? '✓ Uploaded' : 'Category placeholder'}</dd>
          </div>
          {formData.is_recurring && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Recurring</dt>
              <dd className="font-medium text-purple-700">Yes ({formData.frequency})</dd>
            </div>
          )}
          {formData.tags && formData.tags.length > 0 && (
            <div className="flex justify-between items-start">
              <dt className="text-gray-500">Tags</dt>
              <dd className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                {formData.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                    {t}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* ─── Organiser Terms & Conditions (Ticketing Enabled) ─── */}
      {formData.is_ticketing_enabled ? (
        <div className={`p-4 sm:p-5 rounded-xl border transition-all ${
          errors.terms_accepted ? 'bg-red-50/80 border-red-300 shadow-xs' : 'bg-emerald-50/60 border-emerald-200/80'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              name="terms_accepted"
              checked={Boolean(formData.terms_accepted)}
              onChange={(e) => setValue('terms_accepted', e.target.checked, { shouldValidate: true })}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
            />
            <span className="text-xs sm:text-sm text-gray-700 leading-relaxed font-normal">
              I agree to the{' '}
              <a
                href="/terms#organiser"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:text-emerald-800 underline font-semibold"
                onClick={(e) => e.stopPropagation()}
              >
                Organiser Terms of Service
              </a>{' '}
              and confirm that I am responsible for hosting this event and issuing refunds if the event is cancelled or rescheduled.
            </span>
          </label>
          {errors.terms_accepted && (
            <p className="text-xs text-red-600 mt-2 font-medium flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{errors.terms_accepted}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-500 text-center py-1">
          By submitting this event, you confirm that your listing details are accurate in accordance with our{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 hover:text-emerald-800 underline font-medium"
          >
            Terms of Service
          </a>
          .
        </div>
      )}
    </div>
  );
}
