/**
 * Settings Tab Component
 * Email notification preferences with auto-saving toggles
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { UserPreferences, Category } from '@/types';

interface SettingsTabProps {
  categories: Category[];
}

interface SaveMessage {
  type: 'success' | 'error';
  text: string;
}

export function SettingsTab({ categories }: SettingsTabProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const prefs = await api.preferences.get();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load preferences:', error);
        // Set defaults if load fails
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

  // Show save message toast then clear after 2 seconds
  const showSaveMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 2000);
  };

  // Update a single preference with optimistic update
  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!preferences) return;

    // Optimistic update
    const previousValue = preferences[key];
    setPreferences({ ...preferences, [key]: value });
    setIsSaving(true);

    try {
      await api.preferences.update({ [key]: value });
      showSaveMessage('success', 'Preferences saved');
    } catch (error) {
      // Revert on error
      setPreferences({ ...preferences, [key]: previousValue });
      showSaveMessage('error', 'Failed to save');
      console.error('Failed to update preference:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle category in preferred_categories
  const toggleCategory = (categoryId: string) => {
    if (!preferences) return;

    const currentCategories = preferences.preferred_categories || [];
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter((id) => id !== categoryId)
      : [...currentCategories, categoryId];

    updatePreference('preferred_categories', newCategories);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <svg
          className="animate-spin w-8 h-8 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
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
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium transition-opacity ${
            saveMessage.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

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
              onClick={() =>
                updatePreference('weekly_digest', !preferences.weekly_digest)
              }
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                preferences.weekly_digest ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.weekly_digest ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
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
              onClick={() =>
                updatePreference(
                  'organizer_alerts',
                  !preferences.organizer_alerts
                )
              }
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                preferences.organizer_alerts ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.organizer_alerts
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Marketing Emails Toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="font-medium text-gray-900">
                Marketing & Announcements
              </p>
              <p className="text-sm text-gray-500">
                Occasional updates about new features
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.marketing_emails}
              onClick={() =>
                updatePreference(
                  'marketing_emails',
                  !preferences.marketing_emails
                )
              }
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                preferences.marketing_emails ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  preferences.marketing_emails
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Event Interests Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Event Interests
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Select categories you're interested in to personalise your weekly
          digest
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const isSelected = (preferences.preferred_categories || []).includes(
              category.id
            );
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                disabled={isSaving}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                  isSelected
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
