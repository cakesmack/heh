import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { venuesAPI, categoriesAPI } from '@/lib/api';
import { Venue, Category } from '@/types';

export default function AdminImportPage() {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Use a sensible default limit for venues to get a good list for dropdowns
    // Ideally, we'd have a 'simple list' endpoint, but list() works.
    // Assuming list() returns pagination object { venues: [...] } or array (need to check type)
    // venuesAPI.list() returns Promise<VenueListResponse> which has .venues array.

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [venuesRes, categoriesRes] = await Promise.all([
                    venuesAPI.list({ limit: 100 }), // Fetch up to 100 venues for the dropdown
                    categoriesAPI.list()
                ]);

                setVenues(venuesRes.venues);
                setCategories(categoriesRes.categories);
            } catch (error) {
                console.error("Failed to load import data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    return (
        <AdminGuard>
            <AdminLayout title="Import Events">
                <Head>
                    <title>Import Events | Admin Panel</title>
                </Head>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-6">
                            <p className="text-gray-600">
                                Use this wizard to import events from standardized JSON files (e.g. Eden Court).
                                Calculates duplicates and uploads images automatically.
                            </p>
                        </div>

                        <ImportWizard venues={venues} categories={categories} />
                    </div>
                )}
            </AdminLayout>
        </AdminGuard>
    );
}
