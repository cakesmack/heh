/**
 * Admin Categories Page
 * CRUD interface for managing categories
 */

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import ImageUpload from '@/components/common/ImageUpload';
import { categoriesAPI } from '@/lib/api';
import type { Category } from '@/types';

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    gradient_color: '#6B7280',
    display_order: 0,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.list(false);
      setCategories(response.categories);
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
      image_url: '',
      gradient_color: '#6B7280',
      display_order: categories.length,
      is_active: true,
    });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      image_url: category.image_url || '',
      gradient_color: category.gradient_color,
      display_order: category.display_order,
      is_active: category.is_active,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleImageUpload = (urls: { url: string }) => {
    setFormData(prev => ({ ...prev, image_url: urls.url }));
  };

  const handleImageRemove = () => {
    setFormData(prev => ({ ...prev, image_url: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingCategory) {
        await categoriesAPI.update(editingCategory.id, formData);
      } else {
        await categoriesAPI.create(formData);
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      await categoriesAPI.delete(category.id);
      fetchCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (cat: Category) => (
        <div className="flex items-center">
          {cat.image_url ? (
            <img
              src={cat.image_url}
              alt={cat.name}
              className="w-10 h-10 rounded object-cover mr-3"
            />
          ) : (
            <div
              className="w-10 h-10 rounded mr-3"
              style={{ backgroundColor: cat.gradient_color }}
            />
          )}
          <span className="font-medium text-gray-900">{cat.name}</span>
        </div>
      ),
    },
    { key: 'slug', header: 'Slug' },
    { key: 'display_order', header: 'Order' },
    { key: 'event_count', header: 'Events' },
    {
      key: 'is_active',
      header: 'Status',
      render: (cat: Category) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            cat.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {cat.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <AdminGuard>
      <AdminLayout title="Categories">
        <div className="mb-6 flex justify-between items-center">
          <p className="text-gray-600">Manage event categories</p>
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
          title={editingCategory ? 'Edit Category' : 'Add Category'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Category Image */}
            <ImageUpload
              folder="categories"
              currentImageUrl={formData.image_url}
              onUpload={handleImageUpload}
              onRemove={handleImageRemove}
              aspectRatio="16/9"
            />

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
                Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Auto-generated from name if empty"
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
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.gradient_color}
                    onChange={(e) => setFormData({ ...formData, gradient_color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.gradient_color}
                    onChange={(e) => setFormData({ ...formData, gradient_color: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  min={0}
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Active
              </label>
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
