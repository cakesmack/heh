/**
 * Step 1: Core Info & Location
 * Organizer, Title (with duplicate detection), Category, Price, Venue
 */

import React, { useState, useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useEventWizard';
import { Input } from '@/components/common/Input';
import { UnifiedVenueSelect } from '@/components/venues/UnifiedVenueSelect';
import MultiVenueSelector from '@/components/venues/MultiVenueSelector';
import OrganizerSelector from '@/components/events/OrganizerSelector';
import { Category, Organizer, VenueResponse } from '@/types';
import { eventsAPI } from '@/lib/api';
import { isApprovedSeller } from '@/hooks/useAuth';

interface StepBasicsProps {
  form: UseFormReturn<WizardFormData>;
  categories: Category[];
  organizers: Organizer[];
  user: any;
  stepErrors: Record<string, string> | null;
}

interface Suggestion {
  id: string;
  title: string;
  date_start: string;
  venue_name: string | null;
}

export default function StepBasics({
  form,
  categories,
  organizers,
  user,
  stepErrors,
}: StepBasicsProps) {
  const { watch, setValue, getValues } = form;
  const formData = watch();
  const errors = stepErrors || {};

  // Duplicate detection
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleContainerRef = useRef<HTMLDivElement>(null);

  // Multi-venue local state (VenueResponse objects for the selector)
  const [participatingVenueObjects, setParticipatingVenueObjects] = useState<VenueResponse[]>([]);

  // Debounced title suggestion lookup
  useEffect(() => {
    const title = formData.title?.trim() || '';
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (title.length < 5) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      try {
        const results = await eventsAPI.suggestions(title);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formData.title]);

  // Close duplicate suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (titleContainerRef.current && !titleContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Adapter for setFormData pattern used by existing components
  const setFormDataAdapter = (updater: any) => {
    if (typeof updater === 'function') {
      const current = getValues();
      const next = updater(current);
      Object.keys(next).forEach((key) => {
        if (next[key] !== current[key as keyof WizardFormData]) {
          setValue(key as keyof WizardFormData, next[key]);
        }
      });
    } else {
      Object.keys(updater).forEach((key) => {
        setValue(key as keyof WizardFormData, updater[key]);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Organizer Selection ─────────────────────────── */}
      <OrganizerSelector
        user={user}
        organizers={organizers}
        selectedId={formData.organizer_profile_id || ''}
        onChange={(id) => {
          setValue('organizer_profile_id', id);
          setValue('selectedOrganizer', id);
        }}
        error={errors.selectedOrganizer}
      />

      {/* ─── Event Title ────────────────────────────────── */}
      <div ref={titleContainerRef} className="relative">
        <Input
          name="title"
          label="Event Title"
          required
          value={formData.title}
          onChange={(e) => setValue('title', e.target.value)}
          placeholder="e.g. Inverness Photography Club Monthly Meetup"
          error={errors.title}
          className="!py-3 text-lg"
        />

        {isCheckingDuplicates && (
          <p className="mt-1 text-xs text-gray-400">Checking for similar events...</p>
        )}

        {/* Duplicate warning dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-amber-50 border border-amber-300 rounded-xl shadow-lg overflow-hidden">
            <p className="px-4 py-2.5 text-xs font-semibold text-amber-700 bg-amber-100 border-b border-amber-200">
              ⚠️ Possible matches already exist
            </p>
            <ul className="max-h-48 overflow-y-auto divide-y divide-amber-100">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/events/${s.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 hover:bg-amber-100 transition-colors group min-h-[48px]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(s.date_start).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                        {s.venue_name && ` \u00B7 ${s.venue_name}`}
                      </p>
                    </div>
                    <span className="ml-2 text-xs text-amber-600 shrink-0">View \u2197</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ─── Grid: Category & Price ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Selection */}
        <div className="space-y-1">
          <label className="block text-sm font-semibold text-gray-700">Category *</label>
        <select
          name="category_id"
          required
          value={formData.category_id}
          onChange={(e) => setValue('category_id', e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors shadow-sm ${
            errors.category_id ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <option value="">Select a category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
          {errors.category_id && (
            <p className="mt-1 text-sm text-red-600">{errors.category_id}</p>
          )}
        </div>

        {/* Price */}
        <div className="space-y-1">
          <Input
            name="price"
            label="Price"
            type="text"
            value={formData.price}
            onChange={(e) => setValue('price', e.target.value)}
            placeholder='e.g., Free, £5, £5-£10'
            helperText='Enter "Free", or any price format.'
          />
        </div>
      </div>

      {/* ─── Native Ticketing (Tier 2 / Approved Sellers Only) ─── */}
      {isApprovedSeller(user) && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 shadow-xs transition-all">
          <div className="flex items-start justify-between">
            <div className="pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎟️</span>
                <h3 className="text-base font-bold text-emerald-950">Sell Tickets on Highland Events Hub</h3>
              </div>
              <p className="text-sm text-emerald-900/80 mt-1">
                Enable our native ticketing engine to sell tickets directly. Manage inventory, live door scanning, and self-service refunds.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.is_ticketing_enabled || false}
                onChange={(e) => setValue('is_ticketing_enabled', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>
      )}

      {/* ─── Location Section ────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Location</h3>

        {/* Location Tab Toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
          <button
            type="button"
            onClick={() => setValue('locationTab', 'main')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              formData.locationTab === 'main'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Single Venue
          </button>
          <button
            type="button"
            onClick={() => setValue('locationTab', 'multi')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              formData.locationTab === 'multi'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Multi-Venue
          </button>
        </div>

        {/* Single Venue Select */}
        {formData.locationTab === 'main' && (
          <div className="scroll-mt-40" id="venue-select-area">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Venue or Location *</label>
            <UnifiedVenueSelect
              value={formData.venue_id || null}
              onChange={(venueId, venue) => {
                setValue('venue_id', venueId);
                if (venue) {
                  setValue('location_name', venue.name);
                  if (venue.latitude) setValue('latitude', venue.latitude);
                  if (venue.longitude) setValue('longitude', venue.longitude);
                }
              }}
              error={errors.venue_id}
              placeholder="Search for a venue or place..."
            />
          </div>
        )}

        {/* Multi-Venue Select */}
        {formData.locationTab === 'multi' && (
          <div>
            <MultiVenueSelector
              selectedVenues={participatingVenueObjects}
              onChange={(venues) => {
                setParticipatingVenueObjects(venues);
                setValue('participating_venue_ids', venues.map(v => v.id));
              }}
            />
            {errors.participating_venue_ids && (
              <p className="mt-1 text-sm text-red-600">{errors.participating_venue_ids}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
