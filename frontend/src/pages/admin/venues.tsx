import { useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import VenuesManager from '@/components/admin/VenuesManager';
import VenueCategoryManager from '@/components/admin/VenueCategoryManager';

export default function AdminVenuesPage() {
    const router = useRouter();
    const tabQuery = router.query.tab as string;
    const activeTab = tabQuery === 'categories' ? 'categories' : 'all';

    const handleTabChange = (tab: string) => {
        router.push({
            pathname: router.pathname,
            query: { ...router.query, tab }
        }, undefined, { shallow: true });
    };

    return (
        <AdminGuard>
            <AdminLayout title="Venues">
                <div className="mb-6 flex space-x-4 border-b border-gray-200">
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'all'
                            ? 'text-emerald-600 border-b-2 border-emerald-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => handleTabChange('all')}
                    >
                        All Venues
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'categories'
                            ? 'text-emerald-600 border-b-2 border-emerald-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => handleTabChange('categories')}
                    >
                        Categories
                    </button>
                </div>

                {activeTab === 'all' ? <VenuesManager /> : <VenueCategoryManager />}
            </AdminLayout>
        </AdminGuard>
    );
}
