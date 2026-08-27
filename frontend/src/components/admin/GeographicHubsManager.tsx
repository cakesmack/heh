import { useEffect, useState, useCallback } from 'react';
import { AuthGuard } from '@/components/common/AuthGuard';
import toast from 'react-hot-toast';
import { Plus, ArrowRight, Trash2, Pencil, MapPin, Search, X, Check, Globe } from 'lucide-react';

import ImageUpload from '@/components/common/ImageUpload';
import { locationsAPI, eventsAPI } from '@/lib/api';
import { GeographicHub, GeographicHubCreate, GeographicHubUpdate, EventResponse } from '@/types';

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
  const [isCreating, setIsCreating] = useState(false);
  const [deletingHub, setDeletingHub] = useState<GeographicHub | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteHub = async () => {
    if (!deletingHub) return;
    try {
      setIsDeleting(true);
      await locationsAPI.delete(deletingHub.id);
      toast.success(`Location hub "${deletingHub.name}" deleted successfully.`);
      setDeletingHub(null);
      if (editingHub?.id === deletingHub.id) {
        setEditingHub(null);
      }
      fetchHubs();
    } catch (err: any) {
      console.error('Failed to delete hub:', err);
      toast.error(err?.message || 'Failed to delete location hub.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Geographic Hubs</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage SEO metadata, hero images, partner links, and featured events for location hub pages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
            {hubs.length} hubs
          </span>
          {!isCreating && !editingHub && (
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Location Hub</span>
            </button>
          )}
        </div>
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
      ) : isCreating ? (
        <HubCreateForm
          onCancel={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            fetchHubs();
          }}
        />
      ) : editingHub ? (
        <HubEditForm
          hub={editingHub}
          onCancel={() => setEditingHub(null)}
          onSaved={() => {
            setEditingHub(null);
            fetchHubs();
          }}
          onDelete={() => setDeletingHub(editingHub)}
        />
      ) : (
        <HubListTable
          hubs={hubs}
          onEdit={setEditingHub}
          onDelete={(hub) => setDeletingHub(hub)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingHub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-gray-900">Delete Location Hub</h3>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete <span className="font-semibold text-gray-800">{deletingHub.name}</span> (/locations/{deletingHub.slug})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingHub(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteHub}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Delete Hub'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// LIST TABLE
// ============================================================

interface HubListTableProps {
  hubs: GeographicHub[];
  onEdit: (hub: GeographicHub) => void;
  onDelete: (hub: GeographicHub) => void;
}

function HubListTable({ hubs, onEdit, onDelete }: HubListTableProps) {
  if (hubs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <MapPin className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">No Location Hubs Found</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Get started by adding your first geographic location hub.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">SEO Title</th>
              <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hero Image</th>
              <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Featured Event</th>
              <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Partner</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {hubs.map((hub) => (
              <tr
                key={hub.id}
                className="hover:bg-gray-50/80 transition-colors group"
              >
                <td className="px-6 py-4 cursor-pointer" onClick={() => onEdit(hub)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                        {hub.name}
                      </div>
                      <a
                        href={`/locations/${hub.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-gray-400 font-mono hover:text-emerald-600 hover:underline inline-flex items-center gap-1"
                      >
                        /{hub.slug}
                        <Globe className="w-3 h-3 inline" />
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 cursor-pointer" onClick={() => onEdit(hub)}>
                  <span className="text-sm text-gray-600 truncate max-w-[200px] block">
                    {hub.seo_meta_title || <span className="text-gray-300 italic">Not set</span>}
                  </span>
                </td>
                <td className="px-6 py-4 cursor-pointer" onClick={() => onEdit(hub)}>
                  {hub.hero_image_url ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full font-medium">
                      <Check className="w-3 h-3" />
                      Set
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                      Missing
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 cursor-pointer" onClick={() => onEdit(hub)}>
                  {hub.featured_event_id ? (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full font-medium">
                      <Check className="w-3 h-3" />
                      Set
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                      None
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 cursor-pointer" onClick={() => onEdit(hub)}>
                  {hub.partner_name ? (
                    <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                      {hub.partner_name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                      None
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(hub)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(hub);
                      }}
                      className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Location Hub"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ============================================================
// CREATE FORM
// ============================================================

interface HubCreateFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

function HubCreateForm({ onCancel, onCreated }: HubCreateFormProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isCustomSlug, setIsCustomSlug] = useState(false);

  const [formData, setFormData] = useState<GeographicHubCreate>({
    name: '',
    slug: '',
    seo_meta_title: '',
    seo_meta_description: '',
    seo_anchor_text: '',
    hero_image_url: '',
    featured_event_id: '',
    partner_logo: '',
    partner_name: '',
    partner_url: '',
  });

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Featured event selector state
  const [eventSearch, setEventSearch] = useState('');
  const [eventResults, setEventResults] = useState<EventResponse[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedEventTitle, setSelectedEventTitle] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Auto-slug generation
  const handleNameChange = (val: string) => {
    setName(val);
    setFormData(prev => ({ ...prev, name: val }));
    if (!isCustomSlug) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s_-]+/g, '-');
      setSlug(generated);
      setFormData(prev => ({ ...prev, slug: generated }));
    }
  };

  const handleSlugChange = (val: string) => {
    setIsCustomSlug(true);
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleaned);
    setFormData(prev => ({ ...prev, slug: cleaned }));
  };

  // Search events
  useEffect(() => {
    if (!eventSearch || eventSearch.length < 2) {
      setEventResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await eventsAPI.list({
          limit: 15,
          sort_by: 'date',
          time_range: 'upcoming',
        });
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
  }, [eventSearch]);

  const handleCreate = async () => {
    try {
      if (!name.trim()) {
        setCreateError('Location Name is required.');
        return;
      }

      if (formData.partner_logo && (!formData.partner_name || !formData.partner_url)) {
        setCreateError('Partner Name and Partner URL are required when a Partner Logo is provided.');
        return;
      }

      setCreating(true);
      setCreateError(null);

      const payload: Record<string, any> = {
        name: name.trim(),
        slug: (slug || name).trim(),
      };

      for (const [key, value] of Object.entries(formData)) {
        if (key !== 'name' && key !== 'slug') {
          payload[key] = value === '' ? null : value;
        }
      }

      await locationsAPI.create(payload);
      toast.success(`Location hub "${name.trim()}" created successfully!`);
      onCreated();
    } catch (err: any) {
      console.error('Failed to create hub:', err);
      setCreateError(err.message || 'Failed to create location hub');
      toast.error(err.message || 'Failed to create location hub');
    } finally {
      setCreating(false);
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
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors cursor-pointer"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back to all hubs
      </button>

      {/* Main Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Plus className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create New Location Hub</h2>
            <p className="text-sm text-gray-500">
              Add a new geographic destination page to Highland Events Hub.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Location Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Dornoch"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              URL Slug <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm text-gray-400 font-mono">/locations/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="dornoch"
                className="w-full pl-24 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">Unique URL identifier for the location page.</p>
          </div>
        </div>

        {/* SEO Fields */}
        <div className="space-y-5 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" />
            SEO Settings
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Meta Title</label>
            <input
              type="text"
              value={formData.seo_meta_title}
              onChange={(e) => setFormData(prev => ({ ...prev, seo_meta_title: e.target.value }))}
              placeholder={name ? `Events in ${name} | Highland Events Hub` : "Events in [City] | Highland Events Hub"}
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
              placeholder={name ? `Discover upcoming events, festivals, and things to do in ${name}, Scottish Highlands.` : "Discover upcoming events in [City]..."}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              rows={3}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-400">{(formData.seo_meta_description || '').length}/500 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Anchor Text / Subtitle</label>
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

      {/* Hero Image - Cloudflare Upload */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
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
          Featured Event
        </h3>

        {/* Currently selected */}
        {selectedEventTitle && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-900">{selectedEventTitle}</p>
                <p className="text-xs text-blue-500 font-mono">{formData.featured_event_id}</p>
              </div>
            </div>
            <button
              onClick={clearFeaturedEvent}
              className="text-blue-400 hover:text-blue-600 transition-colors p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Search events to feature
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  type="button"
                  onClick={() => selectEvent(event)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {event.image_url ? (
                      <img src={event.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(event.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {event.venue_name && ` · ${event.venue_name}`}
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
          Official Partner
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Optional. Display an official partner logo and link on the public hub page. Both URL and Name are required if a logo is set.
        </p>

        <div className="space-y-5">
          <ImageUpload
            folder="locations"
            currentImageUrl={formData.partner_logo || undefined}
            onUpload={(urls) => setFormData(prev => ({ ...prev, partner_logo: urls.url }))}
            onRemove={() => setFormData(prev => ({ ...prev, partner_logo: '' }))}
            aspectRatio="16/9"
            label="Partner Logo"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Partner Name
            </label>
            <input
              type="text"
              value={formData.partner_name}
              onChange={(e) => setFormData(prev => ({ ...prev, partner_name: e.target.value }))}
              placeholder="e.g. Visit Dornoch"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Partner URL
            </label>
            <input
              type="url"
              value={formData.partner_url}
              onChange={(e) => setFormData(prev => ({ ...prev, partner_url: e.target.value }))}
              placeholder="https://visitdornoch.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              maxLength={500}
            />
          </div>
        </div>
      </div>

      {/* Save Actions */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        {createError ? (
          <p className="text-sm text-rose-600">{createError}</p>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              'Create Location Hub'
            )}
          </button>
        </div>
      </div>
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
  onDelete: () => void;
}

function HubEditForm({ hub, onCancel, onSaved, onDelete }: HubEditFormProps) {
  const [formData, setFormData] = useState<GeographicHubUpdate>({
    name: hub.name || '',
    slug: hub.slug || '',
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

      // Clean up empty strings -> send as null
      const payload: Record<string, any> = {};
      for (const [key, value] of Object.entries(formData)) {
        payload[key] = value === '' ? null : value;
      }

      await locationsAPI.update(hub.id, payload);
      setSaveSuccess(true);
      toast.success('Location hub updated successfully.');
      setTimeout(() => onSaved(), 600);
    } catch (err: any) {
      console.error('Failed to save hub:', err);
      setSaveError(err.message || 'Failed to save changes');
      toast.error(err.message || 'Failed to save changes');
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
      {/* Back Button and Delete Hub */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Back to all hubs
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          Delete Hub
        </button>
      </div>

      {/* Hub Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{hub.name}</h2>
            <a
              href={`/locations/${hub.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-gray-400 font-mono hover:text-emerald-600 inline-flex items-center gap-1"
            >
              /locations/{hub.slug}
              <Globe className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Basic Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Inverness"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
            <input
              type="text"
              value={formData.slug || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="inverness"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono"
            />
          </div>
        </div>

        {/* SEO Fields */}
        <div className="space-y-5 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" />
            SEO Settings
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Meta Title</label>
            <input
              type="text"
              value={formData.seo_meta_title || ''}
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
              value={formData.seo_meta_description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, seo_meta_description: e.target.value }))}
              placeholder={`Discover upcoming events in ${hub.name}, Scottish Highlands...`}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              rows={3}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-400">{(formData.seo_meta_description || '').length}/500 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Anchor Text / Subtitle</label>
            <textarea
              value={formData.seo_anchor_text || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, seo_anchor_text: e.target.value }))}
              placeholder="Descriptive text displayed on the hero banner beneath the heading..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              rows={3}
              maxLength={1000}
            />
          </div>
        </div>
      </div>

      {/* Hero Image - Cloudflare Upload */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
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
          Featured Event
        </h3>

        {/* Currently selected */}
        {selectedEventTitle && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-900">{selectedEventTitle}</p>
                <p className="text-xs text-blue-500 font-mono">{formData.featured_event_id}</p>
              </div>
            </div>
            <button
              onClick={clearFeaturedEvent}
              className="text-blue-400 hover:text-blue-600 transition-colors p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {event.image_url ? (
                      <img src={event.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(event.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {event.venue_name && ` · ${event.venue_name}`}
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
          Official Partner
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Optional. Display an official partner logo on the public hub page. Both URL and Name are required if a logo is set.
        </p>

        <div className="space-y-5">
          <ImageUpload
            folder="locations"
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
              value={formData.partner_name || ''}
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
              value={formData.partner_url || ''}
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
            <Check className="w-4 h-4" />
            Saved successfully
          </p>
        )}
        {!saveError && !saveSuccess && <div />}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
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
