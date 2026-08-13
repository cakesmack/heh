import { useEffect, useState, useCallback } from 'react';
import { AuthGuard } from '@/components/common/AuthGuard';

import ImageUpload from '@/components/common/ImageUpload';
import { locationsAPI, eventsAPI } from '@/lib/api';
import { GeographicHub, GeographicHubUpdate, EventResponse } from '@/types';

export default function GeographicHubsManager() {
  return (
    <AuthGuard requireAdmin>
      <GeographicHubsContent />
    </AuthGuard>
  );
}

function GeographicHubsContent() {
  const [hubs, setHubs] = useState<GeographicHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingHub, setEditingHub] = useState<GeographicHub | null>(null);

  const fetchHubs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await locationsAPI.list();
      setHubs(data);
    } catch (err) {
      console.error('Failed to fetch hubs:', err);
      setError('Failed to load geographic hubs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHubs();
  }, [fetchHubs]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm mt-1">
            Manage SEO metadata, hero images, and featured events for location hub pages.
          </p>
        </div>
        <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
          {hubs.length} hubs
        </span>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : editingHub ? (
        <HubEditForm
          hub={editingHub}
          onCancel={() => setEditingHub(null)}
          onSaved={() => {
            setEditingHub(null);
            fetchHubs();
          }}
        />
      ) : (
        <HubListTable hubs={hubs} onEdit={setEditingHub} />
      )}
    </div>
  );
}


// ============================================================
// LIST TABLE
// ============================================================

function HubListTable({ hubs, onEdit }: { hubs: GeographicHub[]; onEdit: (hub: GeographicHub) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
            <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">SEO Title</th>
            <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hero Image</th>
            <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Featured Event</th>
            <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {hubs.map((hub) => (
            <tr
              key={hub.id}
              className="hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onEdit(hub)}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{hub.name}</div>
                    <div className="text-xs text-gray-400 font-mono">/{hub.slug}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-sm text-gray-600 truncate max-w-[200px] block">
                  {hub.seo_meta_title || <span className="text-gray-300 italic">Not set</span>}
                </span>
              </td>
              <td className="px-6 py-4">
                {hub.hero_image_url ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Set
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    Missing
                  </span>
                )}
              </td>
              <td className="px-6 py-4">
                {hub.featured_event_id ? (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    Set
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    None
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  Edit â†’
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ============================================================
// EDIT FORM
// ============================================================

interface HubEditFormProps {
  hub: GeographicHub;
  onCancel: () => void;
  onSaved: () => void;
}

function HubEditForm({ hub, onCancel, onSaved }: HubEditFormProps) {
  const [formData, setFormData] = useState<GeographicHubUpdate>({
    seo_meta_title: hub.seo_meta_title || '',
    seo_meta_description: hub.seo_meta_description || '',
    seo_anchor_text: hub.seo_anchor_text || '',
    hero_image_url: hub.hero_image_url || '',
    featured_event_id: hub.featured_event_id || '',
    partner_logo: hub.partner_logo || '',
    partner_name: hub.partner_name || '',
    partner_url: hub.partner_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Featured event selector state
  const [eventSearch, setEventSearch] = useState('');
  const [eventResults, setEventResults] = useState<EventResponse[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedEventTitle, setSelectedEventTitle] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Load selected event title on mount if featured_event_id exists
  useEffect(() => {
    if (hub.featured_event_id) {
      eventsAPI.get(hub.featured_event_id)
        .then((event) => setSelectedEventTitle(event.title))
        .catch(() => setSelectedEventTitle('Unknown event'));
    }
  }, [hub.featured_event_id]);

  // Search events for this hub's location
  useEffect(() => {
    if (!eventSearch || eventSearch.length < 2) {
      setEventResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await eventsAPI.list({
          city_filter: hub.slug.replace(/-/g, ' '),
          limit: 15,
          sort_by: 'date',
          time_range: 'upcoming',
        });
        // Filter by title match on client
        const filtered = res.events.filter(e =>
          e.title.toLowerCase().includes(eventSearch.toLowerCase())
        );
        setEventResults(filtered);
      } catch (err) {
        console.error('Event search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [eventSearch, hub.slug]);

  const handleSave = async () => {
    try {
      if (formData.partner_logo && (!formData.partner_name || !formData.partner_url)) {
        setSaveError('Partner Name and Partner URL are required when a Partner Logo is provided.');
        return;
      }
      if (!formData.partner_logo) {
        formData.partner_name = '';
        formData.partner_url = '';
      }

      setSaving(true);
      setSaveError(null);

      // Clean up empty strings â†’ send as null
      const payload: Record<string, any> = {};
      for (const [key, value] of Object.entries(formData)) {
        payload[key] = value === '' ? null : value;
      }

      await locationsAPI.update(hub.id, payload);
      setSaveSuccess(true);
      setTimeout(() => onSaved(), 800);
    } catch (err: any) {
      console.error('Failed to save hub:', err);
      setSaveError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const selectEvent = (event: EventResponse) => {
    setFormData(prev => ({ ...prev, featured_event_id: event.id }));
    setSelectedEventTitle(event.title);
    setEventSearch('');
    setShowDropdown(false);
  };

  const clearFeaturedEvent = () => {
    setFormData(prev => ({ ...prev, featured_event_id: '' }));
    setSelectedEventTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to all hubs
      </button>

      {/* Hub Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{hub.name}</h2>
            <p className="text-sm text-gray-400 font-mono">/locations/{hub.slug}</p>
          </div>
        </div>

        {/* SEO Fields */}
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            SEO Settings
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Meta Title</label>
            <input
              type="text"
              value={formData.seo_meta_title}
              onChange={(e) => setFormData(prev => ({ ...prev, seo_meta_title: e.target.value }))}
              placeholder={`Events in ${hub.name} | Highland Events Hub`}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-gray-400">{(formData.seo_meta_title || '').length}/200 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Meta Description</label>
            <textarea
              value={formData.seo_meta_description}
              onChange={(e) => setFormData(prev => ({ ...prev, seo_meta_description: e.target.value }))}
              placeholder={`Discover upcoming events in ${hub.name}, Scottish Highlands...`}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              rows={3}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-400">{(formData.seo_meta_description || '').length}/500 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Anchor Text</label>
            <textarea
              value={formData.seo_anchor_text}
              onChange={(e) => setFormData(prev => ({ ...prev, seo_anchor_text: e.target.value }))}
              placeholder="Descriptive text displayed on the hero banner beneath the heading..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              rows={3}
              maxLength={1000}
            />
          </div>
        </div>
      </div>

      {/* Hero Image â€” Cloudflare Upload */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Hero Image
        </h3>

        <ImageUpload
          folder="locations"
          currentImageUrl={formData.hero_image_url || undefined}
          onUpload={(urls) => setFormData(prev => ({ ...prev, hero_image_url: urls.url }))}
          onRemove={() => setFormData(prev => ({ ...prev, hero_image_url: '' }))}
          aspectRatio="21/9"
          label={null}
        />
      </div>

      {/* Featured Event Selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Featured Event
        </h3>

        {/* Currently selected */}
        {selectedEventTitle && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">{selectedEventTitle}</p>
                <p className="text-xs text-blue-500 font-mono">{formData.featured_event_id}</p>
              </div>
            </div>
            <button
              onClick={clearFeaturedEvent}
              className="text-blue-400 hover:text-blue-600 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Search events in {hub.name}
          </label>
          <div className="relative">
            <input
              type="text"
              value={eventSearch}
              onChange={(e) => {
                setEventSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Type to search upcoming events..."
              className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Dropdown results */}
          {showDropdown && eventResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {eventResults.map((event) => (
                <button
                  key={event.id}
                  onClick={() => selectEvent(event)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {event.image_url ? (
                      <img src={event.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(event.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {event.venue_name && ` Â· ${event.venue_name}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && eventSearch.length >= 2 && !searchLoading && eventResults.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-400">
              No upcoming events found matching &quot;{eventSearch}&quot;
            </div>
          )}
        </div>

        {/* Close dropdown on outside click */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>

      {/* Partner Block */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Official Partner
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Optional. Display an official partner logo on the public hub page. Both URL and Name are required if a logo is set.
        </p>

        <div className="space-y-5">
          <ImageUpload
            folder="locations/partners"
            currentImageUrl={formData.partner_logo || undefined}
            onUpload={(urls) => setFormData(prev => ({ ...prev, partner_logo: urls.url }))}
            onRemove={() => setFormData(prev => ({ ...prev, partner_logo: '' }))}
            aspectRatio="16/9"
            label="Partner Logo"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Partner Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.partner_name}
              onChange={(e) => setFormData(prev => ({ ...prev, partner_name: e.target.value }))}
              placeholder="e.g. Inverness City Council"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Partner URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={formData.partner_url}
              onChange={(e) => setFormData(prev => ({ ...prev, partner_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              maxLength={500}
            />
          </div>
        </div>
      </div>

      {/* Save Actions */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        {saveError && (
          <p className="text-sm text-rose-600">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Saved successfully
          </p>
        )}
        {!saveError && !saveSuccess && <div />}

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
