import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { heroAPI } from '@/lib/api';
import { HeroSlot } from '@/types';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import ImageUpload from '@/components/common/ImageUpload';

/**
 * Hero Manager - Simplified
 * 
 * Design Philosophy:
 * - Slot 1: Welcome slide, fully editable by admin
 * - Slots 2-5: Auto-managed by payments, read-only display here
 * 
 * The webhook auto-assigns paid HERO_HOME bookings to empty slots.
 * Admins can clear a slot if needed, but assignment is automatic.
 */
export default function HeroManager() {
    const [slots, setSlots] = useState<HeroSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingWelcome, setEditingWelcome] = useState<HeroSlot | null>(null);
    const [clearing, setClearing] = useState<number | null>(null);

    useEffect(() => {
        fetchSlots();
    }, []);

    const fetchSlots = async () => {
        try {
            const data = await heroAPI.list();
            setSlots(data);
        } catch (err) {
            console.error('Failed to fetch slots:', err);
            setError('Failed to load hero slots');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveWelcome = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingWelcome) return;

        try {
            await heroAPI.update(editingWelcome.id, {
                type: 'welcome',
                image_override: editingWelcome.image_override || null,
                title_override: editingWelcome.title_override || null,
                cta_override: editingWelcome.cta_override || null,
            });
            setEditingWelcome(null);
            await fetchSlots();
        } catch (err) {
            console.error('Failed to save:', err);
            alert('Failed to save welcome slide');
        }
    };

    const handleClearSlot = async (slot: HeroSlot) => {
        if (!confirm(`Clear slot ${slot.position}? The event "${slot.event?.title}" will be removed from the carousel.`)) return;

        setClearing(slot.position);
        try {
            await heroAPI.update(slot.id, { event_id: null });
            await fetchSlots();
        } catch (err) {
            console.error('Failed to clear slot:', err);
            alert('Failed to clear slot');
        } finally {
            setClearing(null);
        }
    };

    if (loading) {
        return (
            <AdminGuard>
                <AdminLayout title="Hero Manager">
                    <div className="flex justify-center py-12"><Spinner /></div>
                </AdminLayout>
            </AdminGuard>
        );
    }

    const welcomeSlot = slots.find(s => s.position === 1);
    const eventSlots = [2, 3, 4, 5].map(pos => slots.find(s => s.position === pos));

    return (
        <AdminGuard>
            <AdminLayout title="Hero Manager">
                {/* Header */}
                <div className="mb-8">
                    <p className="text-gray-600">
                        Manage the homepage hero carousel. Slot 1 is the Welcome slide.
                        Slots 2-5 are <strong>automatically filled</strong> when users purchase Hero placements.
                    </p>
                </div>

                {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>}

                {/* Slot 1: Welcome Slide (Editable) */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">1</span>
                        Welcome Slide
                    </h2>

                    {editingWelcome ? (
                        <Card className="p-6 border-2 border-emerald-500">
                            <form onSubmit={handleSaveWelcome} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Background Image</label>
                                    <ImageUpload
                                        folder="events"
                                        currentImageUrl={editingWelcome.image_override}
                                        onUpload={(result) => setEditingWelcome({ ...editingWelcome, image_override: result.url })}
                                        onRemove={() => setEditingWelcome({ ...editingWelcome, image_override: undefined })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Title</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                        value={editingWelcome.title_override || ''}
                                        onChange={e => setEditingWelcome({ ...editingWelcome, title_override: e.target.value })}
                                        placeholder="Discover the Highlands"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Button Text</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                        value={editingWelcome.cta_override || ''}
                                        onChange={e => setEditingWelcome({ ...editingWelcome, cta_override: e.target.value })}
                                        placeholder="Explore Events"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="outline" onClick={() => setEditingWelcome(null)}>Cancel</Button>
                                    <Button type="submit">Save Changes</Button>
                                </div>
                            </form>
                        </Card>
                    ) : (
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {welcomeSlot?.image_override ? (
                                        <img
                                            src={welcomeSlot.image_override}
                                            alt="Welcome"
                                            className="w-24 h-14 object-cover rounded"
                                        />
                                    ) : (
                                        <div className="w-24 h-14 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                                            Default
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-semibold text-gray-900">
                                            {welcomeSlot?.title_override || 'Discover the Highlands'}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            Button: {welcomeSlot?.cta_override || 'Find an Event'}
                                        </p>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => welcomeSlot && setEditingWelcome(welcomeSlot)}>
                                    Edit
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Slots 2-5: Featured Events (Read-Only) */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Featured Event Slots
                        <span className="text-sm font-normal text-gray-500">(Auto-managed by payments)</span>
                    </h2>

                    <div className="grid gap-4">
                        {eventSlots.map((slot, index) => {
                            const position = index + 2;
                            const hasEvent = slot?.event_id && slot?.event;
                            const isClearing = clearing === position;

                            return (
                                <Card key={position} className={`p-4 ${!hasEvent ? 'bg-gray-50 border-dashed' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasEvent ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-500'
                                                }`}>
                                                {position}
                                            </span>

                                            {hasEvent && slot?.event ? (
                                                <>
                                                    {slot.event.image_url ? (
                                                        <img
                                                            src={slot.event.image_url}
                                                            alt={slot.event.title}
                                                            className="w-24 h-14 object-cover rounded"
                                                        />
                                                    ) : (
                                                        <div className="w-24 h-14 bg-gray-200 rounded" />
                                                    )}
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                                            {slot.event.title}
                                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                                                ⭐ Featured
                                                            </span>
                                                        </h3>
                                                        <p className="text-sm text-gray-500">
                                                            {new Date(slot.event.date_start).toLocaleDateString('en-GB', {
                                                                weekday: 'short', day: 'numeric', month: 'short'
                                                            })}
                                                            {slot.event.venue_name && ` • ${slot.event.venue_name}`}
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-gray-500">
                                                    <p className="font-medium">Empty Slot</p>
                                                    <p className="text-sm">Available for purchase</p>
                                                </div>
                                            )}
                                        </div>

                                        {hasEvent && slot && (
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/events/${slot.event_id}`}
                                                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                                >
                                                    View Event →
                                                </Link>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleClearSlot(slot)}
                                                    disabled={isClearing}
                                                >
                                                    {isClearing ? 'Clearing...' : 'Clear'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Help Text */}
                <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <h3 className="font-semibold text-blue-900 mb-2">How Featured Slots Work</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Users purchase <strong>Hero Carousel</strong> placement from the Promote page</li>
                        <li>• Payment automatically assigns their event to the first empty slot (2-5)</li>
                        <li>• Use <strong>Clear</strong> to remove an event and free up a slot</li>
                        <li>• Events also display via FeaturedBooking system, so clearing here doesn't cancel their paid booking</li>
                    </ul>
                </div>
            </AdminLayout>
        </AdminGuard>
    );
}
