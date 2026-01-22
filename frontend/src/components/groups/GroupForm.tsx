import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import ImageUpload from '@/components/common/ImageUpload';

export interface GroupFormData {
    name: string;
    bio: string;
    website_url: string;
    logo_url: string;
    cover_image_url: string;
    city: string;
    public_email: string;
    social_links: Record<string, string>;
    // Explicit social fields
    social_facebook: string;
    social_instagram: string;
    social_website: string;
    social_linkedin: string;
}

interface GroupFormProps {
    initialData?: Partial<GroupFormData>;
    onSubmit: (data: GroupFormData) => Promise<void>;
    isLoading: boolean;
    mode: 'create' | 'edit';
    onCancel: () => void;
    // Optional delete action for edit mode
    onDelete?: () => void;
    isOwner?: boolean;
}

export default function GroupForm({
    initialData,
    onSubmit,
    isLoading,
    mode,
    onCancel,
    onDelete,
    isOwner = false
}: GroupFormProps) {
    const [formData, setFormData] = useState<GroupFormData>({
        name: '',
        bio: '',
        website_url: '',
        logo_url: '',
        cover_image_url: '',
        city: '',
        public_email: '',
        social_links: {},
        social_facebook: '',
        social_instagram: '',
        social_website: '',
        social_linkedin: '',
    });

    // Initialize form data when initialData changes
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                social_links: initialData.social_links || {}
            }));
        }
    }, [initialData]);

    const [newSocialPlatform, setNewSocialPlatform] = useState('');
    const [newSocialUrl, setNewSocialUrl] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddSocialLink = () => {
        if (newSocialPlatform && newSocialUrl) {
            setFormData(prev => ({
                ...prev,
                social_links: {
                    ...prev.social_links,
                    [newSocialPlatform.toLowerCase()]: newSocialUrl,
                },
            }));
            setNewSocialPlatform('');
            setNewSocialUrl('');
        }
    };

    const handleRemoveSocialLink = (platform: string) => {
        setFormData(prev => {
            const links = { ...prev.social_links };
            delete links[platform];
            return { ...prev, social_links: links };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Organization Name *
                    </label>
                    <Input
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g., Highland Music Society"
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                        Bio / Description
                    </label>
                    <textarea
                        id="bio"
                        name="bio"
                        rows={4}
                        value={formData.bio}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Tell people about your organization..."
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-2">
                        Main Website URL
                    </label>
                    <Input
                        id="website_url"
                        name="website_url"
                        type="url"
                        value={formData.website_url}
                        onChange={handleChange}
                        placeholder="https://example.com"
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo
                    </label>
                    <div className="max-w-xs">
                        <ImageUpload
                            folder="organizers"
                            currentImageUrl={formData.logo_url}
                            onUpload={(data) => setFormData(prev => ({ ...prev, logo_url: data.url }))}
                            onRemove={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                            aspectRatio="1/1"
                        />
                        <p className="mt-1 text-xs text-gray-500">Recommended: Square image (1:1), at least 200x200px</p>
                    </div>
                </div>


                {/* Cover Image */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cover Image
                    </label>
                    <div className="w-full">
                        <ImageUpload
                            folder="organizers"
                            currentImageUrl={formData.cover_image_url}
                            onUpload={(data) => setFormData(prev => ({ ...prev, cover_image_url: data.url }))}
                            onRemove={() => setFormData(prev => ({ ...prev, cover_image_url: '' }))}
                            aspectRatio="3/1"
                        />
                        <p className="mt-1 text-xs text-gray-500">Recommended: Landscape image (3:1 aspect ratio), e.g., 1200x400px</p>
                    </div>
                </div>

                {/* City */}
                <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                        City / Location
                    </label>
                    <Input
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="e.g., Inverness"
                        disabled={isLoading}
                    />
                </div>

                {/* Social Media Links */}
                <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Social & Contact</h3>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="social_facebook" className="block text-sm font-medium text-gray-700 mb-2">
                                Facebook URL
                            </label>
                            <Input
                                id="social_facebook"
                                name="social_facebook"
                                type="url"
                                value={formData.social_facebook}
                                onChange={handleChange}
                                placeholder="https://facebook.com/yourpage"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="social_instagram" className="block text-sm font-medium text-gray-700 mb-2">
                                Instagram URL
                            </label>
                            <Input
                                id="social_instagram"
                                name="social_instagram"
                                type="url"
                                value={formData.social_instagram}
                                onChange={handleChange}
                                placeholder="https://instagram.com/yourhandle"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="social_linkedin" className="block text-sm font-medium text-gray-700 mb-2">
                                LinkedIn URL
                            </label>
                            <Input
                                id="social_linkedin"
                                name="social_linkedin"
                                type="url"
                                value={formData.social_linkedin}
                                onChange={handleChange}
                                placeholder="https://linkedin.com/company/yourcompany"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="social_website" className="block text-sm font-medium text-gray-700 mb-2">
                                Additional Website URL
                            </label>
                            <Input
                                id="social_website"
                                name="social_website"
                                type="url"
                                value={formData.social_website}
                                onChange={handleChange}
                                placeholder="https://yourwebsite.com"
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="public_email" className="block text-sm font-medium text-gray-700 mb-2">
                                Public Contact Email
                                <span className="text-gray-500 font-normal ml-1">(visible on your profile)</span>
                            </label>
                            <Input
                                id="public_email"
                                name="public_email"
                                type="email"
                                value={formData.public_email}
                                onChange={handleChange}
                                placeholder="contact@yourorganization.com"
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Social Links (legacy/custom) */}
                <div className="pt-6 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Other Social Links
                    </label>

                    {Object.entries(formData.social_links).length > 0 && (
                        <div className="space-y-2 mb-4">
                            {Object.entries(formData.social_links).map(([platform, url]) => (
                                <div key={platform} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                                    <span className="text-sm">
                                        <span className="font-medium capitalize">{platform}:</span> {url}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSocialLink(platform)}
                                        className="text-red-600 hover:text-red-800 text-sm"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Input
                            placeholder="Platform (e.g., twitter)"
                            value={newSocialPlatform}
                            onChange={(e) => setNewSocialPlatform(e.target.value)}
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Input
                            placeholder="URL"
                            value={newSocialUrl}
                            onChange={(e) => setNewSocialUrl(e.target.value)}
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleAddSocialLink}
                            disabled={isLoading || !newSocialPlatform || !newSocialUrl}
                        >
                            Add
                        </Button>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    {mode === 'edit' && isOwner && onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="text-sm text-red-600 hover:text-red-800"
                        >
                            Delete Profile
                        </button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="text-sm text-gray-600 hover:text-emerald-600 py-2"
                        >
                            Cancel
                        </button>
                        <Button type="submit" variant="primary" size="lg" disabled={isLoading}>
                            {isLoading ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Profile'}
                        </Button>
                    </div>
                </div>
            </form>
        </Card>
    );
}
