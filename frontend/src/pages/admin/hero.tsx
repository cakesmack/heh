import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { heroAPI } from '@/lib/api';
import { HeroSlot } from '@/types';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import ImageUpload from '@/components/common/ImageUpload';
import { toast } from 'react-hot-toast';

export default function HeroManager() {
    const [slots, setSlots] = useState<HeroSlot[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSlots();
    }, []);

    const fetchSlots = async () => {
        try {
            const data = await heroAPI.list();
            // Ensure we sort by position just in case
            const sorted = data.sort((a, b) => a.position - b.position);
            setSlots(sorted);
        } catch (err) {
            console.error('Failed to fetch slots:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (id: number, data: Partial<HeroSlot>) => {
        try {
            await heroAPI.update(id, data);
            toast.success('Slot updated successfully');
            fetchSlots();
        } catch (err) {
            console.error('Failed to update slot:', err);
            toast.error('Failed to update slot');
        }
    };

    if (loading) {
        return (
            <AdminGuard>
                <AdminLayout title="Magazine Grid Manager">
                    <div className="flex justify-center py-12"><Spinner /></div>
                </AdminLayout>
            </AdminGuard>
        );
    }

    const mainSlot = slots.find(s => s.position === 0);
    const sideSlots = slots.filter(s => s.position > 0 && s.position < 4);

    return (
        <AdminGuard>
            <AdminLayout title="Magazine Grid Manager">
                <div className="mb-6">
                    <p className="text-gray-600">
                        Manage the <strong>4-Slot Magazine Grid</strong> on the homepage.
                        <br />
                        <strong>Slot 0:</strong> Main Hero (Left). <strong>Slots 1-3:</strong> Side Stack (Right).
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: MAIN HERO (Slot 0) */}
                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-bold mb-4 text-emerald-800">Main Hero</h2>
                        {mainSlot ? (
                            <SlotEditor slot={mainSlot} onSave={handleSave} isMain={true} />
                        ) : (
                            <div className="p-4 bg-red-50 text-red-600 rounded">Error: Main Slot (0) not found. Run migration.</div>
                        )}
                    </div>

                    {/* Right Column: SIDE STACK (Slots 1, 2, 3) */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold mb-4 text-emerald-800">Side Stack</h2>
                        {sideSlots.map((slot) => (
                            <SlotEditor key={slot.id} slot={slot} onSave={handleSave} isMain={false} />
                        ))}
                        {sideSlots.length === 0 && (
                            <div className="p-4 bg-red-50 text-red-600 rounded">Error: Side Slots (1-3) not found. Run migration.</div>
                        )}
                    </div>
                </div>
            </AdminLayout>
        </AdminGuard>
    );
}

/**
 * Reusable Editor for a Single Slot
 */
function SlotEditor({ slot, onSave, isMain }: { slot: HeroSlot; onSave: (id: number, data: Partial<HeroSlot>) => Promise<void>; isMain: boolean }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<HeroSlot>>({
        title_override: slot.title_override || '',
        link: slot.link || '',
        badge_text: slot.badge_text || '',
        badge_color: slot.badge_color || 'emerald',
        cta_override: slot.cta_override || '',
        image_override: slot.image_override || '',
    });

    const handleChange = (field: keyof HeroSlot, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave(slot.id, formData);
        setIsEditing(false);
    };

    if (!isEditing) {
        // Read-Only Preview Card
        return (
            <Card className="p-4 group relative hover:shadow-md transition-shadow">
                <div className="absolute top-2 right-2">
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
                </div>

                <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className={`shrink-0 bg-gray-100 rounded overflow-hidden ${isMain ? 'w-32 h-20' : 'w-20 h-20'}`}>
                        {slot.image_override ? (
                            <img src={slot.image_override} className="w-full h-full object-cover" alt="Slot" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>
                        )}
                    </div>

                    {/* Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">#{slot.position}</span>
                            {slot.badge_text && (
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-${formData.badge_color}-100 text-${formData.badge_color}-700`}>
                                    {slot.badge_text}
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-gray-900 line-clamp-1">{slot.title_override || 'Untitled Slot'}</h3>
                        {slot.link && <p className="text-xs text-blue-600 truncate max-w-[200px]">{slot.link}</p>}
                    </div>
                </div>
            </Card>
        );
    }

    // Edit Form
    return (
        <Card className={`p-4 border-2 border-emerald-500 ${isMain ? '' : ''}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm text-emerald-800">Editing Slot #{slot.position}</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} type="button">Cancel</Button>
                        <Button size="sm" type="submit">Save</Button>
                    </div>
                </div>

                {/* Image Upload */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Image</label>
                    <ImageUpload
                        folder="hero"
                        currentImageUrl={formData.image_override}
                        onUpload={(res) => handleChange('image_override', res.url)}
                        onRemove={() => handleChange('image_override', null)}
                    />
                </div>

                {/* Fields */}
                <div className={isMain ? "grid grid-cols-2 gap-4" : "space-y-3"}>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Title</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded border-gray-300 text-sm"
                            value={formData.title_override || ''}
                            onChange={(e) => handleChange('title_override', e.target.value)}
                            placeholder="e.g. Discover the Highlands"
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Link URL</label>
                        <input
                            type="text"
                            className="w-full rounded border-gray-300 text-sm"
                            value={formData.link || ''}
                            onChange={(e) => handleChange('link', e.target.value)}
                            placeholder="/events/xyz or https://..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Badge Text</label>
                        <input
                            type="text"
                            className="w-full rounded border-gray-300 text-sm"
                            value={formData.badge_text || ''}
                            onChange={(e) => handleChange('badge_text', e.target.value)}
                            placeholder="e.g. Featured"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Badge Color</label>
                        <select
                            className="w-full rounded border-gray-300 text-sm"
                            value={formData.badge_color}
                            onChange={(e) => handleChange('badge_color', e.target.value)}
                        >
                            <option value="emerald">Emerald (Green)</option>
                            <option value="amber">Amber (Orange)</option>
                            <option value="blue">Blue</option>
                            <option value="rose">Rose (Red)</option>
                            <option value="purple">Purple</option>
                            <option value="gray">Gray</option>
                        </select>
                    </div>

                    {isMain && (
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Button Text</label>
                            <input
                                type="text"
                                className="w-full rounded border-gray-300 text-sm"
                                value={formData.cta_override || ''}
                                onChange={(e) => handleChange('cta_override', e.target.value)}
                                placeholder="Find an Event"
                            />
                        </div>
                    )}
                </div>
            </form>
        </Card>
    );
}
