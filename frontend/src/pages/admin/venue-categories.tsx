/**
 * Admin Venue Categories Page
 * CRUD interface for managing venue categories
 */

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import { venuesAPI } from '@/lib/api';
import type { VenueCategory } from '@/types';

export default function AdminVenueCategories() {
    const [categories, setCategories] = useState<VenueCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<VenueCategory | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = async () => {
        try {
            const data = await venuesAPI.listCategories();
            setCategories(data);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const openCreateModal = () => {
        setEditingCategory(null);
        setFormData({
            name: '',
            slug: '',
            description: '',
        });
        setError(null);
        setModalOpen(true);
    };

    const openEditModal = (category: VenueCategory) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            slug: category.slug,
            description: category.description || '',
        });
        setError(null);
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            if (editingCategory) {
                await venuesAPI.updateCategory(editingCategory.id, formData);
            } else {
                await venuesAPI.createCategory(formData);
            }
            setModalOpen(false);
            fetchCategories();
        } catch (err: any) {
            setError(err.message || 'Failed to save category');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (category: VenueCategory) => {
        if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

        try {
            await venuesAPI.deleteCategory(category.id);
            fetchCategories();
        } catch (err: any) {
            alert(err.message || 'Failed to delete category');
        }
    };

    const columns = [
        {
            key: 'name',
            header: 'Name',
            render: (cat: VenueCategory) => (
                <span className="font-medium text-gray-900">{cat.name}</span>
            ),
        },
        { key: 'slug', header: 'Slug' },
        { key: 'description', header: 'Description' },
    ];

    return (
        <AdminGuard>
            <AdminLayout title="Venue Categories">
                <div className="mb-6 flex justify-between items-center">
                    <p className="text-gray-600">Manage venue types and categories</p>
                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                        Add Category
                    </button>
                </div>

                <DataTable
                    columns={columns}
                    data={categories}
                    loading={loading}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                />

                <Modal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    title={editingCategory ? 'Edit Venue Category' : 'Add Venue Category'}
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Slug *
                            </label>
                            <input
                                type="text"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                placeholder="Auto-generated from name if empty"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </form>
                </Modal>
            </AdminLayout>
        </AdminGuard>
    );
}
