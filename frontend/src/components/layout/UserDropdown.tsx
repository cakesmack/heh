/**
 * UserDropdown Component
 * Shared profile dropdown menu for both desktop and mobile header navigation.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface UserDropdownProps {
  variant?: 'desktop' | 'mobile';
  pendingCount?: number;
}

export function UserDropdown({ variant = 'desktop', pendingCount = 0 }: UserDropdownProps) {
  const { user, isSeller, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const initial = (user?.username || user?.email)?.[0]?.toUpperCase() || 'U';

  return (
    <div className="relative" ref={dropdownRef}>
      {variant === 'desktop' ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 bg-moss-green/20 px-3 py-1.5 rounded-full border border-moss-green/30 hover:bg-moss-green/30 transition-colors cursor-pointer"
          aria-expanded={isOpen}
          aria-label="User menu"
        >
          <span className="text-sm font-medium text-soft-sky">
            {user?.username || user?.email?.split('@')[0]}
          </span>
          <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
            {initial}
          </div>
          <svg
            className={`w-4 h-4 text-mist-grey transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded-full bg-emerald-600 border-2 border-warm-white/40 flex items-center justify-center text-white text-xs font-bold shadow-sm hover:border-golden-heather active:scale-95 transition-all flex-shrink-0 cursor-pointer"
          aria-expanded={isOpen}
          aria-label="User menu"
        >
          {initial}
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl py-1.5 border border-gray-100 z-50 transform origin-top-right transition-all duration-150">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.username || user?.email}</p>
          </div>

          <div className="py-1">
            <Link
              href="/account"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-emerald-600 font-medium transition-colors"
            >
              My Account
            </Link>

            <Link
              href="/account/tickets"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-emerald-600 font-medium transition-colors"
            >
              My Tickets
            </Link>

            {isSeller && (
              <Link
                href="/organizers/hub"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 font-bold flex items-center justify-between transition-colors"
              >
                <span>Organizer Hub</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Pro</span>
              </Link>
            )}

            {user?.is_admin && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-emerald-600 relative transition-colors"
              >
                Admin Dashboard
                {pendingCount > 0 && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Link>
            )}
          </div>

          <div className="pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
