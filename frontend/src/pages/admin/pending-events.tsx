import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { PendingEventsWizard } from '@/components/admin/PendingEventsWizard';
import { venuesAPI, categoriesAPI, api } from '@/lib/api';
import { Venue, Category } from '@/types';

export default function AdminPendingEventsPage() {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [organizers, setOrganizers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [venuesRes, categoriesRes, organizersRes] = await Promise.all([
                    venuesAPI.list({ all: true }).catch(() => ({ venues: [] })), 
                    categoriesAPI.list().catch(() => ({ categories: [] })),
                    api.organizers.list().catch(() => ({ organizers: [] }))
                ]);

                setVenues(Array.isArray(venuesRes) ? venuesRes : venuesRes.venues || []);
                setCategories(Array.isArray(categoriesRes) ? categoriesRes : categoriesRes.categories || []);
                setOrganizers(Array.isArray(organizersRes) ? organizersRes : organizersRes.organizers || []);
            } catch (error) {
                console.error("Failed to load global data for pending events:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    return (
        <AdminGuard>
            <AdminLayout title="Review Pending Events">
                <Head>
                    <title>Review Pending Events | Admin Panel</title>
                </Head>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-6">
                            <p className="text-gray-600">
                                Use this wizard to review and approve newly scraped or queued events into the main database.
                            </p>
                        </div>

                        <PendingEventsWizard
                            venues={venues}
                            categories={categories}
                            organizers={organizers}
                        />
                    </div>
                )}
            </AdminLayout>
        </AdminGuard>
    );
}
