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
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

const SLOT_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  premium: { name: 'Premium Placement', description: 'Featured placement across homepage lists, category headers, and search results' },
  category_pinned: { name: 'Category Pinned', description: 'Top of category page' },
  magazine_carousel: { name: 'Magazine Feature', description: 'Featured in Magazine section' },
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
  const [selectedSlot, setSelectedSlot] = useState<SlotType | null>('premium');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  useEffect(() => {
    const fetchUnavailable = async () => {
      try {
        const dates = await api.featured.getUnavailableDates();
        setUnavailableDates(dates);
      } catch (err) {
        console.error('Failed to load unavailable dates:', err);
      }
    };
    fetchUnavailable();
  }, []);

  useEffect(() => {
    // Sync range selection changes to start/end date input strings
    if (range?.from) {
      const offsetDate = new Date(range.from.getTime() - range.from.getTimezoneOffset() * 60000);
      setStartDate(offsetDate.toISOString().split('T')[0]);
    } else {
      setStartDate('');
    }

    if (range?.to) {
      const offsetDate = new Date(range.to.getTime() - range.to.getTimezoneOffset() * 60000);
      setEndDate(offsetDate.toISOString().split('T')[0]);
    } else {
      setEndDate('');
    }
  }, [range]);

  useEffect(() => {
    // Validate range selection does not bridge over unavailable dates
    if (range?.from && range?.to) {
      const start = new Date(range.from);
      const end = new Date(range.to);
      let current = new Date(start);
      let foundUnavailable = false;

      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        if (unavailableDates.includes(dateStr)) {
          foundUnavailable = true;
          break;
        }
        current.setDate(current.getDate() + 1);
      }

      if (foundUnavailable) {
        setDateValidationError("Your selected range includes unavailable dates.");
        setAvailability(null);
      } else {
        setDateValidationError(null);
      }
    } else {
      setDateValidationError(null);
    }
  }, [range, unavailableDates]);

  useEffect(() => {
    // Check availability when dates or slot changes and selection is valid
    if (selectedSlot && startDate && endDate && !dateValidationError) {
      checkAvailability();
    }
  }, [selectedSlot, event?.category_id, startDate, endDate, dateValidationError]);

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
      
      const tomStr = tomorrow.toISOString().split('T')[0];
      const thrStr = threeDays.toISOString().split('T')[0];
      
      setStartDate(tomStr);
      setEndDate(thrStr);
      setRange({
        from: tomorrow,
        to: threeDays
      });
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
        target_id: selectedSlot === 'category_pinned' ? event?.category_id : undefined,
      });
      setAvailability(result);
    } catch (err) {
      console.error('Availability check failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !startDate || !endDate || !availability?.available || !event || dateValidationError) return;

    setIsSubmitting(true);
    try {
      const result = await api.featured.createCheckout({
        event_id: event.id,  // Use loaded event's ID, not URL param
        slot_type: selectedSlot,
        start_date: startDate,
        end_date: endDate,
        target_id: selectedSlot === 'category_pinned' ? event.category_id : undefined,
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

  // REMOVED isOwner restriction block to allow universal promotion

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
            <h1 className="text-2xl font-bold text-gray-900">
              {isOwner ? "Promote Your Event" : "Sponsor This Event"}
            </h1>

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

          {/* Premium Placement Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Selected Placement</h2>
            <div className="flex items-center justify-between p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/50">
              <div className="mr-4">
                <p className="font-semibold text-gray-900 text-lg">Premium Promotion</p>
                <p className="text-sm text-gray-600 mt-1">
                  Features your event at the top of search results, homepage lists, and category feeds for maximum visibility.
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-gray-900">
                  {getSlotConfig('premium') ? formatPrice(getSlotConfig('premium')!.price_per_day) : '£15.00'}
                </p>
                <p className="text-xs text-gray-500 font-medium">per day</p>
              </div>
            </div>
          </div>

          {/* Date Selection */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Dates</h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose the start and end dates for your Premium Promotion. Fully booked dates are disabled.
            </p>

            <div className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-xl bg-gray-50/50 mb-4">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={setRange}
                disabled={[
                  { before: new Date() },
                  ...unavailableDates.map(d => new Date(d))
                ]}
                styles={{
                  caption: { color: '#047857' }
                }}
                modifiersClassNames={{
                  selected: 'bg-emerald-600 text-white hover:bg-emerald-700',
                  today: 'text-emerald-600 font-bold',
                  range_middle: 'bg-emerald-50 text-emerald-900',
                  range_start: 'bg-emerald-600 text-white rounded-l-md',
                  range_end: 'bg-emerald-600 text-white rounded-r-md'
                }}
              />
            </div>

            {/* Range Text Display */}
            {range?.from && (
              <div className="text-sm text-gray-700 font-medium mb-4 flex justify-between p-3 bg-gray-50 rounded-lg">
                <span>Start Date: <strong className="text-gray-900">{startDate}</strong></span>
                {range.to && (
                  <span>End Date: <strong className="text-gray-900">{endDate}</strong></span>
                )}
              </div>
            )}

            {/* Date Validation Warning */}
            {dateValidationError && (
              <div className="mb-4 p-4 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 text-sm">
                ⚠️ {dateValidationError}
              </div>
            )}

            {/* Availability Status */}
            {isChecking && !dateValidationError && (
              <p className="mt-4 text-gray-500 text-sm">Checking availability...</p>
            )}
            {availability && !isChecking && !dateValidationError && (
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
            disabled={!availability?.available || isSubmitting || !!dateValidationError}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${availability?.available && !isSubmitting && !dateValidationError
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
