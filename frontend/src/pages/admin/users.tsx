/**
 * Admin Users Page
 * List and manage users with detail modal
 */

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import Modal from '@/components/admin/Modal';
import { adminAPI, AdminUser, UserEventSummary } from '@/lib/api';
import Link from 'next/link';

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [skip, setSkip] = useState(0);
  const [limit] = useState(20);
  const [error, setError] = useState<string | null>(null);

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'events'>('profile');
  const [userEvents, setUserEvents] = useState<UserEventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminAPI.listUsers({
        q: searchQuery || undefined,
        skip,
        limit,
      });
      setUsers(response.users);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, skip, limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset modal state when opened
  useEffect(() => {
    if (detailModalOpen) {
      setActiveTab('profile');
      setUserEvents([]);
    }
  }, [detailModalOpen]);

  // Fetch events when tab changes
  useEffect(() => {
    if (activeTab === 'events' && selectedUser) {
      const loadEvents = async () => {
        setEventsLoading(true);
        try {
          const events = await adminAPI.getUserEvents(selectedUser.id);
          setUserEvents(events);
        } catch (err) {
          console.error('Failed to load user events', err);
        } finally {
          setEventsLoading(false);
        }
      };
      loadEvents();
    }
  }, [activeTab, selectedUser]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSkip(0);
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRowClick = (user: AdminUser) => {
    setSelectedUser(user);
    setDetailModalOpen(true);
  };

  const handleToggleAdmin = async (userId: string) => {
    try {
      const updated = await adminAPI.toggleUserAdmin(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? updated : u))
      );
      if (selectedUser?.id === userId) {
        setSelectedUser(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    }
  };

  const handleToggleBan = async (userId: string, currentStatus: boolean, email: string) => {
    const action = currentStatus ? 'Ban' : 'Unban';
    if (!confirm(`Are you sure you want to ${action} user "${email}"?`)) return;

    try {
      const updated = await adminAPI.updateUser(userId, { is_active: !currentStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: updated.is_active } : u))
      );
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, is_active: updated.is_active });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user "${email}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await adminAPI.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotal((prev) => prev - 1);
      setDetailModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleSendPasswordReset = async (userId: string, email: string) => {
    if (!confirm(`Send password reset email to "${email}"?`)) {
      return;
    }
    try {
      const result = await adminAPI.sendPasswordReset(userId);
      alert(result.message || 'Password reset email sent!');
    } catch (err: any) {
      alert(err.message || 'Failed to send password reset email');
    }
  };

  const handleToggleTrusted = async (userId: string, currentStatus: boolean) => {
    try {
      const result = await adminAPI.toggleTrustedOrganizer(userId, !currentStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_trusted_organizer: result.is_trusted_organizer } : u))
      );
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, is_trusted_organizer: result.is_trusted_organizer });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update trusted status');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(skip / limit) + 1;

  return (
    <AdminGuard>
      <AdminLayout title="Users">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-gray-600">
              Manage user accounts ({total} total)
            </p>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by email or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => handleRowClick(user)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.username || user.email.split('@')[0]}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.has_password
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                          }`}>
                          {user.has_password ? 'Email' : 'Google'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!user.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_admin
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {user.is_admin ? 'Admin' : 'User'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{skip + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(skip + limit, total)}
                    </span>{' '}
                    of <span className="font-medium">{total}</span> users
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSkip(Math.max(0, skip - limit))}
                    disabled={skip === 0}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setSkip(skip + limit)}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Detail Modal */}
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title="User Details"
          size="md"
        >
          {selectedUser && (
            <div className="flex flex-col h-full">
              {/* Tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`${activeTab === 'profile'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => setActiveTab('events')}
                    className={`${activeTab === 'events'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                    Events History
                  </button>
                </nav>
              </div>

              {activeTab === 'profile' ? (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                      <p className="text-sm font-medium text-gray-900">{selectedUser.username || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                      <p className="text-sm font-medium text-gray-900">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">User ID</label>
                      <p className="text-sm font-mono text-gray-600 break-all">{selectedUser.id}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Joined</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedUser.created_at)}</p>
                    </div>
                  </div>

                  <hr />


                  {/* Activity Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Events Submitted</label>
                      <p className="text-sm text-gray-900">{selectedUser.event_count}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Check-ins</label>
                      <p className="text-sm text-gray-900">{selectedUser.checkin_count}</p>
                    </div>
                  </div>

                  <hr />

                  {/* Status Badges */}
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.is_admin && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                        Admin
                      </span>
                    )}
                    {selectedUser.is_trusted_organizer && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                        Trusted Organizer
                      </span>
                    )}
                    {!selectedUser.is_active && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        Banned
                      </span>
                    )}
                    {selectedUser.is_active && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap justify-between gap-3 pt-4 border-t">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSendPasswordReset(selectedUser.id, selectedUser.email)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200"
                      >
                        Send Password Reset
                      </button>
                      <button
                        onClick={() => handleDeleteUser(selectedUser.id, selectedUser.email)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200"
                      >
                        Delete User
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleAdmin(selectedUser.id)}
                        className={`px-4 py-2 rounded text-sm font-medium ${selectedUser.is_admin
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                      >
                        {selectedUser.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => handleToggleTrusted(selectedUser.id, selectedUser.is_trusted_organizer)}
                        className={`px-4 py-2 rounded text-sm font-medium ${selectedUser.is_trusted_organizer
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        {selectedUser.is_trusted_organizer ? 'Remove Trusted' : 'Make Trusted'}
                      </button>
                      <button
                        onClick={() => handleToggleBan(selectedUser.id, selectedUser.is_active, selectedUser.email)}
                        className={`px-4 py-2 rounded text-sm font-medium ${!selectedUser.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                      >
                        {selectedUser.is_active ? 'Ban User' : 'Unban User'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Events List Tab */
                <div className="space-y-4">
                  {eventsLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500 mx-auto"></div>
                      <p className="mt-2 text-gray-500 text-sm">Loading event history...</p>
                    </div>
                  ) : userEvents.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      <p className="text-gray-500">No events found for this user.</p>
                    </div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
                      {userEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                          {/* Thumbnail */}
                          <div className="h-12 w-12 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                            {event.image_url ? (
                              <img src={event.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-gray-300">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {event.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {formatDate(event.date_start)}
                              </span>
                              {event.is_recurring && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  Recurring
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status & Action */}
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${event.status === 'published' ? 'bg-green-100 text-green-800' :
                              event.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                              {event.status}
                            </span>
                            <a
                              href={`/admin/events?edit=${event.id}`}
                              target="_blank"
                              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                              Edit
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>
      </AdminLayout>
    </AdminGuard>
  );
}
