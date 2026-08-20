/**
 * BottomNavBar Component
 * Mobile bottom navigation bar
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';

export function BottomNavBar() {
  const router = useRouter();

  const isActive = (path: string) => router.pathname === path;
  const isDiscoverActive = router.pathname.startsWith('/venues') || router.pathname.startsWith('/groups');

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 print:hidden">
      <div className="grid grid-cols-5 h-16">
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
            isActive('/') ? 'text-emerald-600' : 'text-gray-600'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Events */}
        <Link
          href="/events"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
            isActive('/events') ? 'text-emerald-600' : 'text-gray-600'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-[10px] font-medium">Events</span>
        </Link>

        {/* Create Event - Central Prominent Action */}
        <Link
          href="/submit-event"
          className="flex flex-col items-center justify-center space-y-1 text-gray-600 hover:text-emerald-600 transition-colors"
        >
          <div className="bg-emerald-600 p-2 rounded-full shadow-lg -mt-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-[10px] font-medium text-emerald-600">Create</span>
        </Link>

        {/* Map */}
        <Link
          href="/map"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
            isActive('/map') ? 'text-emerald-600' : 'text-gray-600'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <span className="text-[10px] font-medium">Map</span>
        </Link>

        {/* Discover (Venues & Groups) */}
        <Link
          href="/venues"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
            isDiscoverActive ? 'text-emerald-600' : 'text-gray-600'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 21a9 9 0 100-18 9 9 0 000 18z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"
            />
          </svg>
          <span className="text-[10px] font-medium">Discover</span>
        </Link>
      </div>
    </nav>
  );
}
