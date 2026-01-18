'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/admin/Modal';
import ImageUpload from '@/components/common/ImageUpload';
import PlacesAutocomplete from '@/components/maps/PlacesAutocomplete';
import { venuesAPI } from '@/lib/api';
import { isHIERegion } from '@/utils/validation/hie-check';
import { VenueCategory } from '@/types';
import type { VenueResponse, VenueUpdate } from '@/types';
import dynamic from 'next/dynamic';

const GoogleMiniMap = dynamic(() => import('@/components/maps/GoogleMiniMap'), { ssr: false });

interface EditVenueModalProps {
    venueId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function EditVenueModal({ venueId, isOpen, onClose, onSuccess }: EditVenueModalProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<VenueCategory[]>([]);
    const [venue, setVenue] = useState<VenueResponse | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        postcode: '',
        address_full: '',
        latitude: 57.48,
        longitude: -4.22,
        category_id: '',
        description: '',
        website: '',
        phone: '',
        email: '',
        opening_hours: '',
        image_url: '',
        status: 'verified', // Default to verified when admin edits
        // Amenities
        is_dog_friendly: false,
        has_wheelchair_access: false,
        has_parking: false,
        serves_food: false,
        amenities_notes: '',
        // Social Media
        social_facebook: '',
        social_instagram: '',
        social_x: '',
        social_linkedin: '',
        social_tiktok: '',
        website_url: '',
    });

    const [isPostcodeValid, setIsPostcodeValid] = useState(true);

    useEffect(() => {
        if (isOpen && venueId) {
            loadData();
        }
    }, [isOpen, venueId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [venueData, cats] = await Promise.all([
                venuesAPI.get(venueId),
                venuesAPI.listCategories()
            ]);
            setVenue(venueData);
            setCategories(cats);

            setFormData({
                name: venueData.name,
                address: venueData.address,
                postcode: venueData.postcode || '',
                address_full: venueData.address_full || '',
                latitude: venueData.latitude,
                longitude: venueData.longitude,
                category_id: venueData.category_id || (venueData.category?.id || (cats[0]?.id || '')),
                description: venueData.description || '',
                website: venueData.website || '',
                phone: venueData.phone || '',
                email: venueData.email || '',
                opening_hours: venueData.opening_hours || '',
                image_url: venueData.image_url || '',
                status: venueData.status || 'verified',
                is_dog_friendly: (venueData as any).is_dog_friendly || false,
                has_wheelchair_access: (venueData as any).has_wheelchair_access || false,
                has_parking: (venueData as any).has_parking || false,
                serves_food: (venueData as any).serves_food || false,
                amenities_notes: (venueData as any).amenities_notes || '',
                social_facebook: venueData.social_facebook || '',
                social_instagram: venueData.social_instagram || '',
                social_x: venueData.social_x || '',
                social_linkedin: venueData.social_linkedin || '',
                social_tiktok: venueData.social_tiktok || '',
                website_url: venueData.website_url || '',
            });
        } catch (err) {
            console.error(err);
            setError("Failed to load venue details");
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceSelect = (place: any) => {
        setFormData(prev => ({
            ...prev,
            postcode: place.postcode,
            address: place.address,
            address_full: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
        }));
        if (place.postcode) {
            setIsPostcodeValid(isHIERegion(place.postcode));
        } else {
            setIsPostcodeValid(true);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload: any = { ...formData };
            if (!payload.category_id && categories.length > 0) {
                payload.category_id = categories[0].id;
            }
            // Ensure status is sent
            // If status is 'unverified' and we want to verify, user should have changed dropdown.

            await venuesAPI.update(venueId, payload);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to update venue");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Venue" size="lg">
            {loading ? (
                <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div></div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Venue Image */}
                    <div className="mb-4">
                        <ImageUpload
                            folder="venues"
                            currentImageUrl={formData.image_url}
                            onUpload={(res) => setFormData({ ...formData, image_url: res.url })}
                            onRemove={() => setFormData({ ...formData, image_url: '' })}
                            aspectRatio="16/9"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                                <option value="unverified">Unverified (Draft)</option>
                                <option value="verified">Verified (Live)</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                            <select
                                value={formData.category_id}
                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            >
                                <option value="">Select Category</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>

                        {/* Google Places Autocomplete */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Find Address</label>
                            <PlacesAutocomplete onSelect={handlePlaceSelect} placeholder="Search for venue address..." />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>

                        {/* Map Preview */}
                        {formData.latitude && formData.longitude && (
                            <div className="col-span-2">
                                <GoogleMiniMap
                                    latitude={formData.latitude}
                                    longitude={formData.longitude}
                                    height="150px"
                                    zoom={13}
                                />
                            </div>
                        )}

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">
                            {saving ? 'Saving...' : 'Update Venue'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
