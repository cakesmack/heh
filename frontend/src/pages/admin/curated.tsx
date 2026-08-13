import { useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import GeographicHubsManager from '@/components/admin/GeographicHubsManager';
import CollectionsManager from '@/components/admin/CollectionsManager';

export default function AdminCurated() {
    const router = useRouter();
    const tabQuery = router.query.tab as string;
    const activeTab = tabQuery === 'collections' ? 'collections' : 'hubs';

    const handleTabChange = (tab: string) => {
        router.push({
            pathname: router.pathname,
            query: { ...router.query, tab }
        }, undefined, { shallow: true });
    };

    return (
        <AdminGuard>
            <AdminLayout title="Hubs & Collections">
                <div className="mb-6 flex space-x-4 border-b border-gray-200">
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'hubs'
                            ? 'text-emerald-600 border-b-2 border-emerald-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => handleTabChange('hubs')}
                    >
                        Geographic Hubs
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm ${activeTab === 'collections'
                            ? 'text-emerald-600 border-b-2 border-emerald-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => handleTabChange('collections')}
                    >
                        Collections
                    </button>
                </div>

                {activeTab === 'hubs' ? <GeographicHubsManager /> : <CollectionsManager />}
            </AdminLayout>
        </AdminGuard>
    );
}
