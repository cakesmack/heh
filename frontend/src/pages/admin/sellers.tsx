import React from 'react';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import AdminLayout from '@/components/admin/AdminLayout';

export default function SellersAdminPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <AdminLayout title="Seller Vetting">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!user || !user.is_admin) {
    return (
      <AdminLayout title="Unauthorized">
        <div className="p-8 text-center text-red-600">
          <h2 className="text-xl font-bold">Unauthorized</h2>
          <p>You must be an admin to view this page.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Seller Vetting">
      <Head>
        <title>Seller Vetting | Admin</title>
      </Head>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Seller Vetting</h1>
          <p className="text-gray-500 mt-1">
            Review and approve Tier 1 to Tier 2 seller requests.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6">
          <p className="text-gray-500 text-center py-8">
            The seller vetting dashboard components will be rendered here.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
