import { useState, useEffect } from 'react';
import { useRouter as useNextRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import { api, apiFetch } from '@/lib/api';
import { Spinner } from '@/components/common/Spinner';
import type { EventResponse, SlotConfig, SlotType, Category } from '@/types';

export default function PromotePreviewPage() {
  const router = useNextRouter();
  const { id } = router.query;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [eventData, setEventData] = useState<EventResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockupEvent, setMockupEvent] = useState<EventResponse | null>(null);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [categoriesData, configData] = await Promise.all([
        api.categories.list(),
        api.featured.getConfig(),
      ]);
      setCategories(categoriesData.categories || []);
      setSlotConfigs(configData);

      // Try to load event from API
      if (id) {
        try {
          const dbEvent = await api.events.get(id as string);
          setEventData(dbEvent);
        } catch (e) {
          console.error("Failed to load event from db", e);
        }
      }

      // Load local form state draft from sessionStorage
      const draftRaw = sessionStorage.getItem('heh_event_wizard_draft');
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        const data = parsed.data;
        if (data) {
          // Resolve category
          const cat = categoriesData.categories?.find((c: any) => c.id === data.category_id);
          
          const mock: EventResponse = {
            id: (id as string) || 'mock-id',
            title: data.title || 'Your Event',
            description: data.description || '',
            category_id: data.category_id || '',
            category: cat || undefined,
            price: isNaN(parseFloat(data.price)) ? 0 : parseFloat(data.price),
            price_display: (data.price === '0' || !data.price) ? 'Free' : (isNaN(parseFloat(data.price)) ? 'TBC' : `£${parseFloat(data.price).toFixed(2)}`),
            image_url: data.image_url || null,
            date_start: data.date_start || new Date().toISOString(),
            date_end: data.date_end || new Date().toISOString(),
            venue_id: data.venue_id || '',
            location_name: data.location_name || null,
            venue_name: data.locationMode === 'custom' ? (data.location_name || '') : 'Selected Venue',
            status: 'published',
            featured: true,
            featured_until: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            organizer_id: user?.id || '',
            view_count: 0,
            attending_count: 0,
            save_count: 0,
            ticket_click_count: 0,
            website_click_count: 0,
            checkin_count: 0,
            latitude: data.latitude || 57.4778,
            longitude: data.longitude || -4.2247,
          };
          setMockupEvent(mock);
          // Clear draft from session storage now that we have read it
          sessionStorage.removeItem('heh_event_wizard_draft');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load preview data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!id || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Default: Magazine Feature (magazine_carousel) for 3 days starting tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 3);

      const result = await api.featured.createCheckout({
        event_id: eventData?.id || (id as string),
        slot_type: 'magazine_carousel',
        start_date: tomorrow.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

      // Redirect to Stripe
      window.location.href = result.checkout_url;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate checkout. Slot might be fully booked. Try custom dates.');
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const resolvedEvent = mockupEvent || eventData;
  const DAILY_RATE_PENCE = 300; // £3.00 per day
  const priceQuote = DAILY_RATE_PENCE * 3;

  return (
    <>
      <Head>
        <title>Promote Preview - Highland Events Hub</title>
      </Head>

      <div className="min-h-screen bg-stone-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
              Promote Your Event
            </h1>
            <p className="text-stone-500 mt-2">
              Here is how your event will appear in the Featured Spotlight on our homepage:
            </p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
              {error}
            </div>
          )}

          {/* 16:9 Mockup Render using the new PromotedEvents component style */}
          {resolvedEvent && (
            <div className="mb-10 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Mockup Preview</p>
              <div className="max-w-md mx-auto">
                <Link 
                  href="#" 
                  onClick={(e) => e.preventDefault()}
                  className="group relative block aspect-[16/9] w-full overflow-hidden rounded-2xl border border-stone-200 shadow-md pointer-events-none"
                >
                  {resolvedEvent.image_url ? (
                    <img
                      src={resolvedEvent.image_url}
                      alt={resolvedEvent.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-teal-950" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />
                  <div className="absolute top-4 left-4 z-20">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400 text-stone-950 uppercase tracking-wider">
                      ⚡ Promoted
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex flex-col justify-end text-white">
                    {resolvedEvent.category && (
                      <span 
                        className="text-[10px] font-bold uppercase tracking-wider mb-2 self-start px-2 py-0.5 rounded bg-white/10 backdrop-blur-sm"
                        style={{ color: resolvedEvent.category.gradient_color || '#10b981' }}
                      >
                        {resolvedEvent.category.name}
                      </span>
                    )}
                    <h3 className="text-lg sm:text-xl font-bold line-clamp-2 leading-snug">
                      {resolvedEvent.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-stone-300 font-medium">
                      <div className="flex items-center gap-1">
                        <span>📅</span>
                        <span>
                          {new Date(resolvedEvent.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="ml-auto font-bold text-amber-300 text-sm">
                        {resolvedEvent.price_display && !resolvedEvent.price_display.includes('NaN') ? resolvedEvent.price_display : (
                          typeof resolvedEvent.price === 'number' && !isNaN(resolvedEvent.price)
                            ? (resolvedEvent.price === 0 ? 'Free' : `£${resolvedEvent.price.toFixed(2)}`)
                            : 'TBC'
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Booking / Stripe CTA */}
          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm text-center">
            <h3 className="text-stone-900 text-xl font-bold mb-2">Promote Your Event</h3>
            <p className="text-stone-500 text-sm mb-6 max-w-md mx-auto">
              Promote your event from £3 a day and get featured in the Magazine spotlight row on our homepage.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-colors min-w-[200px]"
              >
                {isSubmitting ? 'Connecting...' : `Pay & Feature Now (£${(priceQuote / 100).toFixed(2)})`}
              </button>

              <Link
                href={`/events/${id}/promote`}
                className="w-full sm:w-auto px-8 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl transition-colors text-center"
              >
                Choose Custom Dates & Slots
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-stone-100">
              <Link href={`/events/${id}`} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
                Skip and view event detail page &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
