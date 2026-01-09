/**
 * ConsentContext - Cookie Consent State Management
 * GDPR-compliant cookie consent system
 */
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ConsentStatus = 'undecided' | 'granted' | 'denied';

interface ConsentContextType {
    consentStatus: ConsentStatus;
    giveConsent: () => void;
    denyConsent: () => void;
}

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

const CONSENT_STORAGE_KEY = 'cookie_consent';

export function ConsentProvider({ children }: { children: ReactNode }) {
    const [consentStatus, setConsentStatus] = useState<ConsentStatus>('undecided');
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize from localStorage on mount
    useEffect(() => {
        const storedConsent = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (storedConsent === 'granted' || storedConsent === 'denied') {
            setConsentStatus(storedConsent);
        }
        setIsInitialized(true);
    }, []);

    const giveConsent = () => {
        localStorage.setItem(CONSENT_STORAGE_KEY, 'granted');
        setConsentStatus('granted');
    };

    const denyConsent = () => {
        localStorage.setItem(CONSENT_STORAGE_KEY, 'denied');
        setConsentStatus('denied');
    };

    // Don't render until we've checked localStorage to prevent flash
    if (!isInitialized) {
        return null;
    }

    return (
        <ConsentContext.Provider value={{ consentStatus, giveConsent, denyConsent }}>
            {children}
        </ConsentContext.Provider>
    );
}

export function useConsent() {
    const context = useContext(ConsentContext);
    if (context === undefined) {
        throw new Error('useConsent must be used within a ConsentProvider');
    }
    return context;
}
