import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api';

export default function ProcessingPage() {
  const router = useRouter();
  const { payment_intent, payment_intent_client_secret, redirect_status } = router.query;
  const [status, setStatus] = useState('processing');
  
  const intentId = (payment_intent as string) || (payment_intent_client_secret ? (payment_intent_client_secret as string).split('_secret_')[0] : null);

  useEffect(() => {
    if (!router.isReady) return;
    
    if (redirect_status === 'failed') {
      setStatus('failed');
      return;
    }

    if (!intentId) {
      // If no payment_intent is present after query ready, trigger timeout/fallback
      const noIntentTimer = setTimeout(() => {
        setStatus('timeout');
      }, 3000);
      return () => clearTimeout(noIntentTimer);
    }

    let isSubscribed = true;
    let pollTimeout: NodeJS.Timeout;

    const poll = async () => {
      try {
        const eventParam = router.query.event_id ? `?event_id=${router.query.event_id}` : '';
        const res = await axios.get(`${API_BASE_URL}/api/ticketing/checkout/intent-status/${intentId}${eventParam}`);
        if (
          res.data &&
          (res.data.status === 'completed' || res.data.status === 'succeeded') &&
          res.data.order_ref
        ) {
          if (isSubscribed) {
            router.replace(`/orders/${res.data.order_ref}`);
          }
          return;
        }
      } catch (e) {
        // Continue polling
      }
      
      if (isSubscribed) {
        pollTimeout = setTimeout(poll, 1500);
      }
    };
    
    poll();
    
    // Strict 15-second timeout safeguard
    const safetyTimeout = setTimeout(() => {
      if (isSubscribed) {
        setStatus('timeout');
      }
    }, 15000);
    
    return () => {
      isSubscribed = false;
      clearTimeout(pollTimeout);
      clearTimeout(safetyTimeout);
    };
  }, [intentId, redirect_status, router, router.isReady]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border border-gray-100">
        {status === 'processing' && (
          <div className="space-y-4">
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-900">Processing Payment...</h1>
            <p className="text-sm text-gray-600">Please wait while we confirm your tickets. Do not close or refresh this page.</p>
          </div>
        )}
        
        {status === 'failed' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">!</div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Failed</h1>
            <p className="text-sm text-gray-600">There was an issue processing your payment. Your card was not charged.</p>
            <div className="pt-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
        
        {status === 'timeout' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">⏱️</div>
            <h1 className="text-xl font-bold text-gray-900">Order Confirmation in Progress</h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your payment is processing, but order confirmation is taking longer than expected. Please check your email for your tickets.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-4">
              <Link
                href="/"
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition text-center"
              >
                Return Home
              </Link>
              <Link
                href="/account/tickets"
                className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold py-2.5 px-4 rounded-xl text-xs transition text-center"
              >
                View My Tickets
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
