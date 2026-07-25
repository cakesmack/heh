import React, { useState, useEffect } from 'react';
import { PendingEvent, Venue, Category } from '@/types';
import ImageUpload from '@/components/common/ImageUpload';
import RichTextEditor from '@/components/common/RichTextEditor';
import DateTimePicker from '@/components/common/DateTimePicker';
import { UnifiedVenueSelect } from '@/components/venues/UnifiedVenueSelect';
import GooglePlacesAutocomplete from '@/components/common/GooglePlacesAutocomplete';
import { Check, Save, X, AlertTriangle, Image as ImageIcon, ExternalLink, Clock, Sparkles } from 'lucide-react';

export interface EventFormData extends Partial<PendingEvent> {
  venue_id?: string | null;
  category_id?: string | null;
  website_url?: string | null;
}

interface EventFormProps {
  initialValues: Partial<EventFormData>;
  venues?: Venue[];
  categories?: Category[];
  rawShowtimes?: string[];
  onSaveDraft?: (data: EventFormData) => Promise<void>;
  onApprovePublish?: (data: EventFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const EventForm: React.FC<EventFormProps> = ({
  initialValues,
  venues = [],
  categories = [],
  rawShowtimes = [],
  onSaveDraft,
  onApprovePublish,
  onCancel,
  isSubmitting = false,
}) => {
  const categoryList = Array.isArray(categories) ? categories : [];
  const venueList = Array.isArray(venues) ? venues : [];
  const showtimeList = Array.isArray(rawShowtimes) ? rawShowtimes : [];

  const [formData, setFormData] = useState<EventFormData>({});
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [noEndTime, setNoEndTime] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialValues) {
      // Safe matching against venueList
      const matchedVenue = venueList.find(
        (v) =>
          v.id === initialValues.venue_id ||
          v.name.toLowerCase() === (initialValues.venue_name || '').toLowerCase()
      );

      // Safe matching against categoryList
      const matchedCategory = categoryList.find(
        (c) =>
          c.id === initialValues.category_id ||
          c.name.toLowerCase() === (initialValues.category_name || '').toLowerCase()
      );

      setSelectedVenueId(matchedVenue ? matchedVenue.id : initialValues.venue_id || null);
      setSelectedCategoryId(matchedCategory ? matchedCategory.id : initialValues.category_id || '');
      setNoEndTime(!initialValues.date_end);

      setFormData({
        title: initialValues.title || '',
        description: initialValues.description || '',
        date_start: initialValues.date_start ? initialValues.date_start.slice(0, 16) : '',
        date_end: initialValues.date_end ? initialValues.date_end.slice(0, 16) : undefined,
        venue_name: initialValues.venue_name || matchedVenue?.name || '',
        category_name: initialValues.category_name || matchedCategory?.name || '',
        venue_id: matchedVenue?.id || initialValues.venue_id || null,
        category_id: matchedCategory?.id || initialValues.category_id || null,
        price_display: initialValues.price_display || '',
        min_price: initialValues.min_price ?? undefined,
        ticket_url: initialValues.ticket_url || '',
        website_url: initialValues.website_url || '',
        image_url: initialValues.image_url || '',
        age_restriction: initialValues.age_restriction || '',
        min_age: initialValues.min_age ?? 0,
      });
    }
  }, [initialValues, venueList, categoryList]);

  const updateFormData = (patch: Partial<EventFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveDraft) return;
    try {
      setSaving(true);
      await onSaveDraft(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleApprovePublish = async () => {
    if (!onApprovePublish) return;
    try {
      setSaving(true);
      await onApprovePublish(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveDraft} className="space-y-8 p-6 bg-white rounded-2xl">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Side: Media & Reference Panel */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
          {/* Image Upload Component */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Event Image</label>
            <ImageUpload
              folder="events"
              currentImageUrl={formData.image_url || ''}
              onUpload={(res) => updateFormData({ image_url: res.url })}
              onRemove={() => updateFormData({ image_url: '' })}
              onUploadStart={() => setUploading(true)}
              onUploadEnd={() => setUploading(false)}
              aspectRatio="16/9"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Image URL (Direct)</label>
            <input
              type="text"
              value={formData.image_url || ''}
              onChange={(e) => updateFormData({ image_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="https://..."
            />
          </div>

          {/* Raw Showtimes Reference */}
          {showtimeList.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-900">
              <span className="font-bold block mb-2 text-amber-800 uppercase tracking-wider text-[11px]">
                Parsed Raw Showtimes
              </span>
              <ul className="space-y-1 max-h-48 overflow-y-auto font-mono text-[11px]">
                {showtimeList.map((st, i) => (
                  <li key={i} className="bg-white/80 p-1.5 rounded border border-amber-200/50">
                    {st}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Side: Form Controls */}
        <div className="flex-1 space-y-8">
          {/* Block 1: Core Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                1
              </span>
              Core Information
            </h3>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => updateFormData({ title: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base font-semibold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="Enter event title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Description Workspace
              </label>
              <RichTextEditor
                value={formData.description || ''}
                onChange={(val) => updateFormData({ description: val })}
                placeholder="Describe the event details..."
              />
            </div>
          </div>

          {/* Block 2: Logistics & Category */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                2
              </span>
              Logistics & Category
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Select (Database categories ONLY) */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => {
                    const catId = e.target.value;
                    setSelectedCategoryId(catId);
                    const matched = categoryList.find((c) => c.id === catId);
                    updateFormData({
                      category_id: catId || null,
                      category_name: matched ? matched.name : '',
                    });
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                >
                  <option value="">Select Category...</option>
                  {categoryList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date & Time */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Start Date & Time <span className="text-red-500">*</span>
                </label>
                <DateTimePicker
                  id="date_start"
                  name="date_start"
                  value={formData.date_start || ''}
                  onChange={(val) => updateFormData({ date_start: val })}
                  required
                />
              </div>

              {/* End Date & Time */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-bold text-gray-700">End Date & Time</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noEndTime}
                      onChange={(e) => {
                        setNoEndTime(e.target.checked);
                        updateFormData({
                          date_end: e.target.checked ? undefined : formData.date_start,
                        });
                      }}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    No specific end time
                  </label>
                </div>
                {!noEndTime && (
                  <DateTimePicker
                    id="date_end"
                    name="date_end"
                    value={formData.date_end || ''}
                    onChange={(val) => updateFormData({ date_end: val })}
                    min={formData.date_start}
                  />
                )}
              </div>
            </div>

            {/* Venue Location Selection (Database Lookup + Custom Autocomplete Fallback) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Venue Location Search
              </label>
              <UnifiedVenueSelect
                value={selectedVenueId}
                onChange={(id, venue) => {
                  setSelectedVenueId(id || null);
                  updateFormData({
                    venue_id: id || null,
                    venue_name: venue ? venue.name : formData.venue_name,
                  });
                }}
                placeholder={formData.venue_name || 'Search database venues...'}
              />
            </div>

            {!selectedVenueId && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <p className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  No database venue selected. Custom location input will be used.
                </p>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Location Name (Custom)
                  </label>
                  <input
                    type="text"
                    value={formData.venue_name || ''}
                    onChange={(e) => updateFormData({ venue_name: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. Inverness Castle Grounds"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Address Search (Google Places API)
                  </label>
                  <GooglePlacesAutocomplete
                    defaultValue={formData.venue_name || ''}
                    onPlaceSelect={(place) => {
                      updateFormData({
                        venue_name: place.formatted_address || place.name || formData.venue_name,
                      });
                    }}
                    placeholder="Search custom address..."
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Block 3: Links & Settings */}
          <div className="space-y-6 pb-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                3
              </span>
              Links & Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Website URL (website_url)
                </label>
                <input
                  type="url"
                  value={formData.website_url || ''}
                  onChange={(e) => updateFormData({ website_url: e.target.value })}
                  placeholder="https://example.com/official-page"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Ticket URL (ticket_url)
                </label>
                <input
                  type="url"
                  value={formData.ticket_url || ''}
                  onChange={(e) => updateFormData({ ticket_url: e.target.value })}
                  placeholder="https://example.com/tickets"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Price Display
                </label>
                <input
                  type="text"
                  value={formData.price_display || ''}
                  onChange={(e) => updateFormData({ price_display: e.target.value })}
                  placeholder="e.g. £15.00 / Free"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Min Age (0+)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_age ?? 0}
                  onChange={(e) => updateFormData({ min_age: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving || isSubmitting || uploading}
          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          {onSaveDraft && (
            <button
              type="submit"
              disabled={saving || isSubmitting || uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Draft...' : 'Save Draft'}
            </button>
          )}

          {onApprovePublish && (
            <button
              type="button"
              onClick={handleApprovePublish}
              disabled={saving || isSubmitting || uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Processing...' : 'Approve & Publish'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
