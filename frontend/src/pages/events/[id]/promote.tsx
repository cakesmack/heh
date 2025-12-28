/**
 * Promote Event Page
 * Allows organizers to purchase featured placement for their events
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Spinner } from '@/components/common/Spinner';
import type { EventResponse, SlotConfig, SlotType, AvailabilityResponse, Category } from '@/types';

const SLOT_DESCRIPTIONS: Record<SlotType, { name: string; description: string }> = {
  hero_home: { name: 'Hero Carousel', description: 'Maximum visibility on homepage' },
  global_pinned: { name: 'Homepage Pinned', description: 'Top of all events list' },
  category_pinned: { name: 'Category Pinned', description: 'Top of category page' },
  newsletter: { name: 'Weekly Newsletter', description: 'Featured in Thursday digest' },
};

export default function PromoteEventPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [event, setEvent] = useState<EventResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedSlot, setSelectedSlot] = useState<SlotType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customSubtitle, setCustomSubtitle] = useState<string>('');  // For hero carousel

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  useEffect(() => {
    // Check availability when dates or slot changes
    if (selectedSlot && startDate && endDate) {
      checkAvailability();
    }
  }, [selectedSlot, selectedCategory, startDate, endDate]);

  const loadData = async () => {
    try {
      const [eventData, configData, categoriesData] = await Promise.all([
        api.events.get(id as string),
        api.featured.getConfig(),
        api.categories.list(),
      ]);
      setEvent(eventData);
      setSlotConfigs(configData);
      setCategories(categoriesData.categories || []);

      // Set default dates (tomorrow to 3 days from now)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const threeDays = new Date();
      threeDays.setDate(threeDays.getDate() + 4);
      setStartDate(tomorrow.toISOString().split('T')[0]);
      setEndDate(threeDays.toISOString().split('T')[0]);
    } catch (err) {
      setError('Failed to load event');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!selectedSlot || !startDate || !endDate) return;

    setIsChecking(true);
    try {
      const result = await api.featured.checkAvailability({
        slot_type: selectedSlot,
        start_date: startDate,
        end_date: endDate,
        target_id: selectedSlot === 'category_pinned' ? selectedCategory || undefined : undefined,
      });
      setAvailability(result);
    } catch (err) {
      console.error('Availability check failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !startDate || !endDate || !availability?.available || !event) return;

    setIsSubmitting(true);
    try {
      const result = await api.featured.createCheckout({
        event_id: event.id,  // Use loaded event's ID, not URL param
        slot_type: selectedSlot,
        start_date: startDate,
        end_date: endDate,
        target_id: selectedSlot === 'category_pinned' ? selectedCategory || undefined : undefined,
        custom_subtitle: selectedSlot === 'hero_home' ? customSubtitle || undefined : undefined,
      });

      // Redirect to Stripe Checkout
      window.location.href = result.checkout_url;
    } catch (err: any) {
      setError(err.message || 'Failed to create checkout');
      setIsSubmitting(false);
    }
  };

  const getSlotConfig = (slotType: SlotType) => {
    return slotConfigs.find(c => c.slot_type === slotType);
  };

  const formatPrice = (pence: number) => {
    return `£${(pence / 100).toFixed(2)}`;
  };

  // Check if user owns this event
  const isOwner = user && event && (event.organizer_id === user.id || user.is_admin);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to promote events</p>
          <Link href="/login" className="text-emerald-600 hover:underline">Sign In</Link>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Event not found</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">You can only promote your own events</p>
          <Link href={`/events/${id}`} className="text-emerald-600 hover:underline">Back to event</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Promote {event.title} - Highland Events Hub</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <Link href={`/events/${id}`} className="text-emerald-600 hover:underline text-sm mb-2 inline-block">
              &larr; Back to event
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Promote Your Event</h1>
            <p className="text-gray-600 mt-1">{event.title}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
          )}

          {router.query.cancelled && (
            <div className="mb-6 p-4 bg-amber-50 text-amber-700 rounded-lg">
              Payment was cancelled. You can try again below.
            </div>
          )}

          {/* Slot Selection */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Placement</h2>
            <div className="space-y-3">
              {(['hero_home', 'global_pinned', 'category_pinned'] as SlotType[]).map(slotType => {
                const config = getSlotConfig(slotType);
                const info = SLOT_DESCRIPTIONS[slotType];
                if (!config) return null;

                return (
                  <label
                    key={slotType}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedSlot === slotType
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="slot"
                        value={slotType}
                        checked={selectedSlot === slotType}
                        onChange={() => setSelectedSlot(slotType)}
                        className="sr-only"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{info.name}</p>
                        <p className="text-sm text-gray-500">{info.description}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {formatPrice(config.price_per_day)}/day
                    </p>
                  </label>
                );
              })}
            </div>

            {/* Category Selection for Category Pinned */}
            {selectedSlot === 'category_pinned' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Category
                </label>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Choose a category...</option>
                  {categories.filter(c => c.is_active).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Subtitle for Hero Carousel */}
            {selectedSlot === 'hero_home' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Subtitle <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={customSubtitle}
                  onChange={(e) => setCustomSubtitle(e.target.value)}
                  placeholder="e.g. Don't miss this spectacular Highland experience!"
                  maxLength={200}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This text will appear below your event title in the hero carousel. Max 200 characters.
                </p>
              </div>
            )}
          </div>

          {/* Date Selection */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Dates</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Availability Status */}
            {isChecking && (
              <p className="mt-4 text-gray-500 text-sm">Checking availability...</p>
            )}
            {availability && !isChecking && (
              <div className={`mt-4 p-4 rounded-lg ${availability.available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                {availability.available ? (
                  <p>&#10003; Dates available</p>
                ) : (
                  <p>&#10007; {availability.error || `Some dates unavailable: ${availability.unavailable_dates.join(', ')}`}</p>
                )}
              </div>
            )}
          </div>

          {/* Price Summary */}
          {availability?.available && selectedSlot && (
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-700">
                  {availability.num_days} days × {formatPrice(getSlotConfig(selectedSlot)?.price_per_day || 0)}/day
                </span>
                <span className="font-bold text-gray-900 text-2xl">
                  {formatPrice(availability.price_quote)}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!availability?.available || isSubmitting || (selectedSlot === 'category_pinned' && !selectedCategory)}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${availability?.available && !isSubmitting && !(selectedSlot === 'category_pinned' && !selectedCategory)
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            {isSubmitting ? 'Redirecting to payment...' : 'Proceed to Payment'}
          </button>

          {/* Info */}
          <p className="text-center text-sm text-gray-500 mt-4">
            You'll be redirected to Stripe for secure payment
          </p>
        </div>
      </div>
    </>
  );
}
