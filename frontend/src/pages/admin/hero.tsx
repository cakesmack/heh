import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { heroAPI, eventsAPI } from '@/lib/api';
import { HeroSlot, EventResponse } from '@/types';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import ImageUpload from '@/components/common/ImageUpload';

export default function HeroManager() {
    const [slots, setSlots] = useState<HeroSlot[]>([]);
    const [events, setEvents] = useState<EventResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingSlot, setEditingSlot] = useState<HeroSlot | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [slotsData, eventsData] = await Promise.all([
                heroAPI.list(),
                eventsAPI.list({ limit: 100, date_from: new Date().toISOString() }) // Get upcoming events
            ]);
            setSlots(slotsData);
            setEvents(eventsData.events);
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('Failed to load hero slots');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (slot: HeroSlot) => {
        try {
            await heroAPI.update(slot.id, { is_active: !slot.is_active });
            fetchData();
        } catch (err) {
            console.error('Failed to update slot:', err);
            alert('Failed to update slot status');
        }
    };

    const handleSaveSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSlot) return;

        try {
            // Build update payload, excluding undefined values
            const updatePayload: any = {
                type: editingSlot.type,
                overlay_style: editingSlot.overlay_style,
            };

            if (editingSlot.type === 'spotlight_event') {
                // Remove dashes from event_id to match database format (UUIDs stored without dashes)
                const cleanEventId = editingSlot.event_id?.replace(/-/g, '') || null;
                updatePayload.event_id = cleanEventId;
                // Clear welcome-specific fields
                updatePayload.image_override = null;
                updatePayload.title_override = null;
                updatePayload.cta_override = null;
            } else {
                // Welcome slide
                updatePayload.image_override = editingSlot.image_override || null;
                updatePayload.title_override = editingSlot.title_override || null;
                updatePayload.cta_override = editingSlot.cta_override || null;
                // Clear event-specific fields
                updatePayload.event_id = null;
            }

            console.log('Saving hero slot:', editingSlot.id, 'with payload:', updatePayload);
            const response = await heroAPI.update(editingSlot.id, updatePayload);
            console.log('Save response:', response);

            setEditingSlot(null);
            await fetchData();
            console.log('Data refetched after save');
        } catch (err) {
            console.error('Failed to save slot:', err);
            alert('Failed to save slot');
        }
    };

    if (loading) return <AdminGuard><AdminLayout title="Hero Manager"><Spinner /></AdminLayout></AdminGuard>;

    return (
        <AdminGuard>
            <AdminLayout title="Hero Manager">
                <div className="mb-6">
                    <p className="text-gray-600">Manage the 5 slots on the homepage hero carousel.</p>
                </div>

                {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>}

                <div className="grid gap-6">
                    {/* Create slots if they don't exist (1-5) */}
                    {[1, 2, 3, 4, 5].map((position) => {
                        const slot = slots.find(s => s.position === position);

                        if (!slot) {
                            return (
                                <Card key={position} className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-4">
                                        <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                                            {position}
                                        </span>
                                        <span className="text-gray-500 italic">Empty Slot</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={async () => {
                                            await heroAPI.create({ position, type: position === 1 ? 'welcome' : 'spotlight_event' });
                                            fetchData();
                                        }}
                                    >
                                        Initialize Slot
                                    </Button>
                                </Card>
                            );
                        }

                        const isEditing = editingSlot?.id === slot.id;

                        if (isEditing) {
                            return (
                                <Card key={slot.id} className="p-6 border-2 border-emerald-500">
                                    <form onSubmit={handleSaveSlot} className="space-y-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-lg">Editing Slot {position}</h3>
                                            <Button variant="outline" size="sm" onClick={() => setEditingSlot(null)}>Cancel</Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Type</label>
                                                <select
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                                    value={editingSlot.type}
                                                    onChange={e => setEditingSlot({ ...editingSlot, type: e.target.value as any })}
                                                    disabled={position === 1} // Slide 1 is always Welcome
                                                >
                                                    <option value="welcome">Welcome Slide</option>
                                                    <option value="spotlight_event">Spotlight Event</option>
                                                </select>
                                                {position === 1 && <p className="text-xs text-gray-500 mt-1">Slide 1 is always a Welcome slide.</p>}
                                            </div>

                                            {editingSlot.type === 'spotlight_event' ? (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Event</label>
                                                    <select
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                                        value={editingSlot.event_id || ''}
                                                        onChange={e => setEditingSlot({ ...editingSlot, event_id: e.target.value })}
                                                        required
                                                    >
                                                        <option value="">Select an event...</option>
                                                        {events.map(event => (
                                                            <option key={event.id} value={event.id}>{event.title}</option>
                                                        ))}
                                                    </select>
                                                    <p className="text-xs text-gray-500 mt-1">Image, title, and details will be pulled from the event.</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Background Image</label>
                                                        <ImageUpload
                                                            folder="events"
                                                            currentImageUrl={editingSlot.image_override}
                                                            onUpload={(result) => setEditingSlot({ ...editingSlot, image_override: result.url })}
                                                            onRemove={() => setEditingSlot({ ...editingSlot, image_override: undefined })}
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-gray-700">Title Text</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                                            value={editingSlot.title_override || ''}
                                                            onChange={e => setEditingSlot({ ...editingSlot, title_override: e.target.value })}
                                                            placeholder="Welcome to Highland Events"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="block text-sm font-medium text-gray-700">Subtitle</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                                            value={(editingSlot as any).subtitle || ''}
                                                            onChange={e => setEditingSlot({ ...editingSlot, subtitle: e.target.value } as any)}
                                                            placeholder="Discover amazing events across the Highlands"
                                                        />
                                                    </div>

                                                    {/* Primary CTA */}
                                                    <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg">
                                                        <h4 className="text-sm font-medium text-gray-900 mb-3">Primary Call-to-Action</h4>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Button Text</label>
                                                                <input
                                                                    type="text"
                                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                                                    value={editingSlot.cta_override || ''}
                                                                    onChange={e => setEditingSlot({ ...editingSlot, cta_override: e.target.value })}
                                                                    placeholder="Explore Events"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Link URL</label>
                                                                <input
                                                                    type="text"
                                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                                                    value={(editingSlot as any).cta_link || ''}
                                                                    onChange={e => setEditingSlot({ ...editingSlot, cta_link: e.target.value } as any)}
                                                                    placeholder="/events"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Secondary CTA */}
                                                    <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg">
                                                        <h4 className="text-sm font-medium text-gray-900 mb-3">Secondary Call-to-Action (Optional)</h4>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Button Text</label>
                                                                <input
                                                                    type="text"
                                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                                                    value={(editingSlot as any).secondary_cta_text || ''}
                                                                    onChange={e => setEditingSlot({ ...editingSlot, secondary_cta_text: e.target.value } as any)}
                                                                    placeholder="View Map"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Link URL</label>
                                                                <input
                                                                    type="text"
                                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                                                    value={(editingSlot as any).secondary_cta_link || ''}
                                                                    onChange={e => setEditingSlot({ ...editingSlot, secondary_cta_link: e.target.value } as any)}
                                                                    placeholder="/map"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex justify-end gap-2 pt-4">
                                            <Button type="submit">Save Changes</Button>
                                        </div>
                                    </form>
                                </Card>
                            );
                        }

                        return (
                            <Card key={slot.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 ${!slot.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                                <div className="flex items-center gap-4 mb-4 md:mb-0">
                                    <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                                        {position}
                                    </span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-gray-900">
                                                {slot.type === 'welcome' ? 'Welcome Slide' : (slot.event?.title || 'No Event Selected')}
                                            </h3>
                                            {!slot.is_active && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactive</span>}
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            {slot.type === 'welcome'
                                                ? (slot.title_override || 'Default Welcome')
                                                : (slot.event ? `${new Date(slot.event.date_start).toLocaleDateString()} • ${slot.event.venue_name || 'Unknown Venue'}` : 'Select an event')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleToggleActive(slot)}>
                                        {slot.is_active ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <Button size="sm" onClick={() => setEditingSlot(slot)}>
                                        Edit
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </AdminLayout>
        </AdminGuard>
    );
}
