import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { heroAPI } from '@/lib/api';
import { HeroSlot } from '@/types';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import ImageUpload from '@/components/common/ImageUpload';

/**
 * Welcome Slide Manager
 * 
 * Manages ONLY Slide 1 (The Welcome Slide).
 * All other slots (2-5) are strictly "Direct Fetch" from paid FeaturedBookings
 * and are not managed via this interface.
 */
export default function HeroManager() {
    const [welcomeSlot, setWelcomeSlot] = useState<HeroSlot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingWelcome, setEditingWelcome] = useState<HeroSlot | null>(null);

    useEffect(() => {
        fetchWelcomeSlot();
    }, []);

    const fetchWelcomeSlot = async () => {
        try {
            const data = await heroAPI.list();
            // Find position 1 or type welcome
            const slot = data.find(s => s.position === 1 || s.type === 'welcome');
            setWelcomeSlot(slot || null);
        } catch (err) {
            console.error('Failed to fetch slots:', err);
            setError('Failed to load welcome settings');
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
            await fetchWelcomeSlot();
        } catch (err) {
            console.error('Failed to save:', err);
            alert('Failed to save welcome slide');
        }
    };

    if (loading) {
        return (
            <AdminGuard>
                <AdminLayout title="Welcome Slide Manager">
                    <div className="flex justify-center py-12"><Spinner /></div>
                </AdminLayout>
            </AdminGuard>
        );
    }

    return (
        <AdminGuard>
            <AdminLayout title="Welcome Slide Manager">
                {/* Header */}
                <div className="mb-8">
                    <p className="text-gray-600">
                        Manage the static <strong>Welcome Slide</strong> (Slide 1) of the homepage carousel.
                        <br />
                        Slides 2-5 are automatically populated by active <strong>Paid Featured Events</strong> (Hero Home).
                    </p>
                </div>

                {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>}

                {/* Welcome Slide (Editable) */}
                <div className="max-w-3xl">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">1</span>
                        Welcome Slide Configuration
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
                                    <p className="text-xs text-gray-500 mt-1">Recommended: 1920x1080px or higher.</p>
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
                                        placeholder="Find an Event"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="outline" onClick={() => setEditingWelcome(null)}>Cancel</Button>
                                    <Button type="submit">Save Changes</Button>
                                </div>
                            </form>
                        </Card>
                    ) : (
                        <Card className="p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-6">
                                    {welcomeSlot?.image_override ? (
                                        <div className="shrink-0">
                                            <img
                                                src={welcomeSlot.image_override}
                                                alt="Welcome"
                                                className="w-48 h-28 object-cover rounded shadow-sm"
                                            />
                                        </div>
                                    ) : (
                                        <div className="shrink-0 w-48 h-28 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-300">
                                            No Custom Image
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Title</span>
                                            <p className="text-lg font-bold text-gray-900">
                                                {welcomeSlot?.title_override || 'Discover the Highlands'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Button</span>
                                            <p className="text-gray-700">
                                                {welcomeSlot?.cta_override || 'Find an Event'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={() => welcomeSlot && setEditingWelcome(welcomeSlot)}>
                                    Edit Settings
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Automation Note */}
                <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
                    <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h3 className="font-semibold text-blue-900">What about other slides?</h3>
                        <p className="text-sm text-blue-800 mt-1">
                            Additional slides are automatically generated from active <strong>Featured Bookings</strong>.
                            When an organizer pays for a "Hero Homepage" slot, their event will automatically appear in carousel slots 2, 3, 4, or 5.
                        </p>
                    </div>
                </div>
            </AdminLayout>
        </AdminGuard>
    );
}
