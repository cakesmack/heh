/**
 * CookieBanner Component
 * GDPR-compliant cookie consent banner
 * Only visible when consentStatus is 'undecided'
 */
'use client';

import { useConsent } from '@/context/ConsentContext';
import Link from 'next/link';

export default function CookieBanner() {
    const { consentStatus, giveConsent, denyConsent } = useConsent();

    // Only show when undecided
    if (consentStatus !== 'undecided') {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-900 border-t border-slate-700 shadow-2xl">
            <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Text */}
                    <div className="text-center sm:text-left">
                        <p className="text-white text-sm">
                            We use cookies to analyze traffic and help venue managers understand their audience.{' '}
                            <Link href="/cookies" className="text-emerald-400 hover:text-emerald-300 underline">
                                Learn more
                            </Link>
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                            onClick={denyConsent}
                            className="px-4 py-2 text-sm font-medium text-gray-300 border border-gray-500 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Necessary Only
                        </button>
                        <button
                            onClick={giveConsent}
                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            Accept Analytics
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
