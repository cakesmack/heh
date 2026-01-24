/**
 * Create Organizer Profile Page
 */
import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { AuthGuard } from '@/components/common/AuthGuard';
import { Button } from '@/components/ui/button';
import GroupForm, { GroupFormData } from '@/components/groups/GroupForm';

export default function CreateOrganizerPage() {
    return (
        <AuthGuard>
            <CreateOrganizerContent />
        </AuthGuard>
    );
}

function CreateOrganizerContent() {
    const router = useRouter();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (formData: GroupFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            const data = {
                name: formData.name,
                bio: formData.bio || undefined,
                website_url: formData.website_url || undefined,
                logo_url: formData.logo_url || undefined,
                // New fields
                cover_image_url: formData.cover_image_url || undefined,
                city: formData.city || undefined,
                public_email: formData.public_email || undefined,
                // Socials
                social_links: Object.keys(formData.social_links).length > 0 ? formData.social_links : undefined,
                social_facebook: formData.social_facebook || undefined,
                social_instagram: formData.social_instagram || undefined,
                social_website: formData.social_website || undefined,
                social_linkedin: formData.social_linkedin || undefined,
            };

            await api.organizers.create(data);
            router.push('/account');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create organizer profile');
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/account" className="text-sm text-gray-600 hover:text-emerald-600 mb-4 inline-block">
                        &larr; Back to Account
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Create Organizer Profile</h1>
                    <p className="text-gray-600 mt-2">Create a profile for your organization, group, or venue to manage events.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                <GroupForm
                    mode="create"
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    onCancel={() => router.push('/account')}
                />
            </div>
        </div>
    );
}
