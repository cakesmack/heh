/**
 * Settings Tab Component
 * Email notification preferences, in-app notification settings, and manage follows
 */

import { useState, useEffect } from 'react';
import { api, userSettingsAPI, followsAPI } from '@/lib/api';
import type { UserPreferences, Category } from '@/types';
import Link from 'next/link';

interface SettingsTabProps {
  categories: Category[];
}

interface SaveMessage {
  type: 'success' | 'error';
  text: string;
}

interface FollowedItem {
  id: string;
  name: string;
  slug?: string;
  image_url?: string;
  logo_url?: string;
}

export function SettingsTab({ categories }: SettingsTabProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);

  // Notification settings state
  const [receiveInterestNotifications, setReceiveInterestNotifications] = useState(true);

  // Follows state
  const [followedCategories, setFollowedCategories] = useState<FollowedItem[]>([]);
  const [followedVenues, setFollowedVenues] = useState<FollowedItem[]>([]);
  const [followedGroups, setFollowedGroups] = useState<FollowedItem[]>([]);
  const [activeFollowTab, setActiveFollowTab] = useState<'categories' | 'venues' | 'groups'>('categories');
  const [isLoadingFollows, setIsLoadingFollows] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const prefs = await api.preferences.get();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load preferences:', error);
        setPreferences({
          weekly_digest: true,
          organizer_alerts: true,
          marketing_emails: false,
          preferred_categories: [],
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadPreferences();
  }, []);

  // Load notification settings
  useEffect(() => {
    async function loadNotificationSettings() {
      try {
        const settings = await userSettingsAPI.getNotificationSettings();
        setReceiveInterestNotifications(settings.receive_interest_notifications);
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      }
    }
    loadNotificationSettings();
  }, []);

  // Load followed items - fetch each separately to avoid one failure blocking all
  useEffect(() => {
    async function loadFollows() {
      setIsLoadingFollows(true);

      // Fetch categories
      try {
        const catRes = await followsAPI.getFollowedCategories();
        console.log('Categories response:', catRes);
        setFollowedCategories(catRes.categories || []);
      } catch (error) {
        console.error('Failed to load followed categories:', error);
      }

      // Fetch venues
      try {
        const venueRes = await followsAPI.getFollowedVenues();
        console.log('Venues response:', venueRes);
        setFollowedVenues(venueRes.venues || []);
      } catch (error) {
        console.error('Failed to load followed venues:', error);
      }

      // Fetch groups
      try {
        const groupRes = await followsAPI.getFollowedGroups();
        console.log('Groups response:', groupRes);
        setFollowedGroups(groupRes.groups || []);
      } catch (error) {
        console.error('Failed to load followed groups:', error);
      }

      setIsLoadingFollows(false);
    }
    loadFollows();
  }, []);

  const showSaveMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!preferences) return;
    const previousValue = preferences[key];
    setPreferences({ ...preferences, [key]: value });
    setIsSaving(true);

    try {
      await api.preferences.update({ [key]: value });
      showSaveMessage('success', 'Preferences saved');
    } catch (error) {
      setPreferences({ ...preferences, [key]: previousValue });
      showSaveMessage('error', 'Failed to save');
      console.error('Failed to update preference:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    if (!preferences) return;
    const currentCategories = preferences.preferred_categories || [];
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter((id) => id !== categoryId)
      : [...currentCategories, categoryId];
    updatePreference('preferred_categories', newCategories);
  };

  // Update notification setting
  const toggleInterestNotifications = async () => {
    const newValue = !receiveInterestNotifications;
    setReceiveInterestNotifications(newValue);
    setIsSaving(true);

    try {
      await userSettingsAPI.updateNotificationSettings({ receive_interest_notifications: newValue });
      showSaveMessage('success', 'Notification settings saved');
    } catch (error) {
      setReceiveInterestNotifications(!newValue);
      showSaveMessage('error', 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Unfollow handlers
  const handleUnfollowCategory = async (id: string) => {
    try {
      await followsAPI.unfollowCategory(id);
      setFollowedCategories(prev => prev.filter(c => c.id !== id));
      showSaveMessage('success', 'Unfollowed');
    } catch (error) {
      showSaveMessage('error', 'Failed to unfollow');
    }
  };

  const handleUnfollowVenue = async (id: string) => {
    try {
      await followsAPI.unfollowVenue(id);
      setFollowedVenues(prev => prev.filter(v => v.id !== id));
      showSaveMessage('success', 'Unfollowed');
    } catch (error) {
      showSaveMessage('error', 'Failed to unfollow');
    }
  };

  const handleUnfollowGroup = async (id: string) => {
    try {
      await followsAPI.unfollowGroup(id);
      setFollowedGroups(prev => prev.filter(g => g.id !== id));
      showSaveMessage('success', 'Unfollowed');
    } catch (error) {
      showSaveMessage('error', 'Failed to unfollow');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <svg className="animate-spin w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-12 text-gray-500">
        Unable to load preferences
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Save message toast */}
      {saveMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium transition-opacity ${saveMessage.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}>
          {saveMessage.text}
        </div>
      )}

      {/* In-App Notifications Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          In-App Notifications
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="font-medium text-gray-900">New Event Alerts</p>
              <p className="text-sm text-gray-500">
                Get notified when new events are posted in categories, venues, or groups you follow
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={receiveInterestNotifications}
              onClick={toggleInterestNotifications}
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${receiveInterestNotifications ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${receiveInterestNotifications ? 'translate-x-5' : 'translate-x-0'
                }`} />
            </button>
          </div>
        </div>
      </section>

      {/* Manage Follows Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Manage Follows
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Events from these will appear in your feed and you'll get notifications for new events.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['categories', 'venues', 'groups'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFollowTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeFollowTab === tab
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-1 text-xs opacity-75">
                ({tab === 'categories' ? followedCategories.length : tab === 'venues' ? followedVenues.length : followedGroups.length})
              </span>
            </button>
          ))}
        </div>

        {/* Follow Lists */}
        <div className="bg-gray-50 rounded-xl p-4 min-h-[120px]">
          {isLoadingFollows ? (
            <div className="flex items-center justify-center h-20">
              <svg className="animate-spin w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <>
              {activeFollowTab === 'categories' && (
                <div className="space-y-2">
                  {followedCategories.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No followed categories. <Link href="/categories" className="text-emerald-600 hover:underline">Browse categories</Link></p>
                  ) : followedCategories.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <button
                        onClick={() => handleUnfollowCategory(item.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeFollowTab === 'venues' && (
                <div className="space-y-2">
                  {followedVenues.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No followed venues. <Link href="/venues" className="text-emerald-600 hover:underline">Browse venues</Link></p>
                  ) : followedVenues.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                        )}
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                      <button
                        onClick={() => handleUnfollowVenue(item.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeFollowTab === 'groups' && (
                <div className="space-y-2">
                  {followedGroups.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No followed groups. <Link href="/groups" className="text-emerald-600 hover:underline">Browse groups</Link></p>
                  ) : followedGroups.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        {item.logo_url && (
                          <img src={item.logo_url} alt="" className="w-8 h-8 rounded object-cover" />
                        )}
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                      <button
                        onClick={() => handleUnfollowGroup(item.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Email Notifications Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Email Notifications
        </h2>
        <div className="space-y-3">
          {/* Weekly Digest Toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="font-medium text-gray-900">Weekly Digest</p>
              <p className="text-sm text-gray-500">
                Personalised event picks every Thursday
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.weekly_digest}
              onClick={() => updatePreference('weekly_digest', !preferences.weekly_digest)}
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${preferences.weekly_digest ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences.weekly_digest ? 'translate-x-5' : 'translate-x-0'
                }`} />
            </button>
          </div>

          {/* Organizer Alerts Toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="font-medium text-gray-900">Organizer Alerts</p>
              <p className="text-sm text-gray-500">
                Get notified when your events go live
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.organizer_alerts}
              onClick={() => updatePreference('organizer_alerts', !preferences.organizer_alerts)}
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${preferences.organizer_alerts ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences.organizer_alerts ? 'translate-x-5' : 'translate-x-0'
                }`} />
            </button>
          </div>

          {/* Marketing Emails Toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="font-medium text-gray-900">Marketing & Announcements</p>
              <p className="text-sm text-gray-500">
                Occasional updates about new features
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.marketing_emails}
              onClick={() => updatePreference('marketing_emails', !preferences.marketing_emails)}
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${preferences.marketing_emails ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences.marketing_emails ? 'translate-x-5' : 'translate-x-0'
                }`} />
            </button>
          </div>
        </div>
      </section>

      {/* Event Interests Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Digest Preferences
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Select categories to personalise your weekly digest email
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const isSelected = (preferences.preferred_categories || []).includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                disabled={isSaving}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${isSelected
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
        {categories.length === 0 && (
          <p className="text-sm text-gray-400 italic">
            No categories available
          </p>
        )}
      </section>
    </div>
  );
}

export default SettingsTab;

