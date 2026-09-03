'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

const STORAGE_KEY = 'he_hub_ticketing_banner_dismissed';

export function TicketingAnnouncementBanner() {
  const [isDismissed, setIsDismissed] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
      setIsDismissed(dismissed);
    } catch {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // LocalStorage access might fail in private browsing mode
    }
  };

  if (!mounted || isDismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Ticketing Launch Announcement"
      className="bg-[#0B3B2C] text-emerald-100 border-b border-emerald-800/40 relative z-50 text-xs sm:text-sm font-normal print:hidden"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-2 min-h-[36px]">
        <div className="flex-1 flex items-center justify-center text-center pr-6 sm:pr-0">
          <span className="inline-flex items-center flex-wrap justify-center gap-x-1.5 gap-y-0.5 leading-snug">
            <span>
              <strong className="text-white font-semibold">Organisers:</strong> You can now sell tickets directly on Highland Events Hub with lower fees and direct Stripe payouts.
            </span>
            <Link
              href="/sell-tickets"
              className="text-amber-300 hover:text-amber-200 underline font-semibold transition-colors inline-flex items-center whitespace-nowrap ml-1"
            >
              Learn how it works →
            </Link>
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="text-emerald-300 hover:text-white p-1 rounded hover:bg-emerald-900/60 transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </aside>
  );
}
