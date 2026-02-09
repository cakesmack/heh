import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Modal from '@/components/admin/Modal';
import { VenueResponse } from '@/types';
import { venuesAPI } from '@/lib/api';
import { Button } from '@/components/common/Button';
import ImageUpload from '@/components/common/ImageUpload';
import PlacesAutocomplete from '@/components/maps/PlacesAutocomplete';
import { isHIERegion } from '@/utils/validation/hie-check';
import dynamic from 'next/dynamic';

// Dynamic import for GoogleMiniMap to avoid SSR issues
const GoogleMiniMap = dynamic(() => import('@/components/maps/GoogleMiniMap'), { ssr: false });

interface VenueEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    venue: VenueResponse;
    onUpdate: () => void;
}

export default function VenueEditModal({ isOpen, onClose, venue, onUpdate }: VenueEditModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        postcode: '',
        address_full: '',
        latitude: 57.48,
        longitude: -4.22,
        description: '',
        website: '',
        phone: '',
        email: '',
        image_url: '',
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
    const [saving, setSaving] = useState(false);

    // Initialize form data when venue changes or modal opens
    useEffect(() => {
        if (venue && isOpen) {
            setFormData({
                name: venue.name,
                address: venue.address,
                postcode: venue.postcode || '',
                address_full: venue.address_full || '',
                latitude: venue.latitude,
                longitude: venue.longitude,
                description: venue.description || '',
                website: venue.website || '',
                phone: venue.phone || '',
                email: venue.email || '',
                image_url: venue.image_url || '',
                is_dog_friendly: venue.is_dog_friendly || false,
                has_wheelchair_access: venue.has_wheelchair_access || false,
                has_parking: venue.has_parking || false,
                serves_food: venue.serves_food || false,
                amenities_notes: venue.amenities_notes || '',
                social_facebook: venue.social_facebook || '',
                social_instagram: venue.social_instagram || '',
                social_x: venue.social_x || '',
                social_linkedin: venue.social_linkedin || '',
                social_tiktok: venue.social_tiktok || '',
                website_url: venue.website_url || '',
            });
            setIsPostcodeValid(true);
        }
    }, [venue, isOpen]);

    const handlePlaceSelect = (place: {
        postcode: string;
        address: string;
        latitude: number;
        longitude: number;
        placeId: string;
    }) => {
        setFormData(prev => ({
            ...prev,
            postcode: place.postcode,
            address: place.address,
            address_full: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
        }));
        // Validate HIE region using postcode if available
        if (place.postcode) {
            setIsPostcodeValid(isHIERegion(place.postcode));
        } else {
            setIsPostcodeValid(true);
        }
    };

    const handleImageUpload = (urls: { url: string }) => {
        setFormData(prev => ({ ...prev, image_url: urls.url }));
    };

    const handleImageRemove = () => {
        setFormData(prev => ({ ...prev, image_url: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.postcode && !isHIERegion(formData.postcode)) {
            toast.error('Venue must be located in the Highlands & Islands region');
            setIsPostcodeValid(false);
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                postcode: formData.postcode || '',
                address_full: formData.address_full || '',
                image_url: formData.image_url || undefined,
                // Ensure we don't accidentally send nulls where strings are expected
                website: formData.website || undefined,
                phone: formData.phone || undefined,
                email: formData.email || undefined,
            };

            await venuesAPI.update(venue.id, payload);
            toast.success('Venue details updated successfully');
            onUpdate(); // Trigger parent refresh
            onClose();
        } catch (err: any) {
            console.error('Update error:', err);
            toast.error(err.message || 'Failed to update venue');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Venue Details"
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Image Upload */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Venue Image</label>
                    <ImageUpload
                        folder="venues"
                        currentImageUrl={formData.image_url}
                        onUpload={handleImageUpload}
                        onRemove={handleImageRemove}
                        aspectRatio="16/9"
                    />
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            placeholder="Tell people about your venue..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Public Email</label>
                        <input
                            type="text"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                        <input
                            type="url"
                            value={formData.website}
                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            placeholder="https://"
                        />
                    </div>
                </div>

                {/* Location */}
                <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Location</h3>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Find Address</label>
                        <PlacesAutocomplete onSelect={handlePlaceSelect} placeholder="Search for venue address..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                            <input
                                type="text"
                                value={formData.postcode}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, postcode: val });
                                    setIsPostcodeValid(val ? isHIERegion(val) : true);
                                }}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${!isPostcodeValid ? 'border-red-500 focus:ring-red-500' : 'focus:ring-emerald-500'
                                    }`}
                            />
                            {!isPostcodeValid && (
                                <p className="text-xs text-red-600 mt-1">Must be in the Highlands & Islands</p>
                            )}
                        </div>
                    </div>

                    {/* Map Preview */}
                    {formData.latitude && formData.longitude && (
                        <div className="mt-4 h-48 w-full rounded-lg overflow-hidden border border-gray-200">
                            <GoogleMiniMap
                                latitude={formData.latitude}
                                longitude={formData.longitude}
                                height="100%"
                                zoom={14}
                            />
                        </div>
                    )}
                </div>

                {/* Amenities */}
                <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Amenities</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_dog_friendly}
                                onChange={(e) => setFormData({ ...formData, is_dog_friendly: e.target.checked })}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-700">Dog Friendly</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.has_wheelchair_access}
                                onChange={(e) => setFormData({ ...formData, has_wheelchair_access: e.target.checked })}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-700">Wheelchair Access</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.has_parking}
                                onChange={(e) => setFormData({ ...formData, has_parking: e.target.checked })}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-700">Parking</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.serves_food}
                                onChange={(e) => setFormData({ ...formData, serves_food: e.target.checked })}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-700">Serves Food</span>
                        </label>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Other Amenities</label>
                        <textarea
                            value={formData.amenities_notes}
                            onChange={(e) => setFormData({ ...formData, amenities_notes: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            placeholder="e.g. Baby changing facilities, free WiFi..."
                        />
                    </div>
                </div>

                {/* Social Media */}
                <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Social Media</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                            <input
                                type="url"
                                value={formData.social_facebook}
                                onChange={(e) => setFormData({ ...formData, social_facebook: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                placeholder="https://facebook.com/..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                            <input
                                type="url"
                                value={formData.social_instagram}
                                onChange={(e) => setFormData({ ...formData, social_instagram: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                placeholder="https://instagram.com/..."
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t mt-6">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                        type="button"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={saving || !isPostcodeValid}
                        isLoading={saving}
                    >
                        Save Changes
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

