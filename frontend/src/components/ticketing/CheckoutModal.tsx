import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { API_BASE_URL } from '@/lib/api';

const defaultStripePubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

interface CheckoutFormProps {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  totalAmount: number;
  onBack: () => void;
  onSuccess: (orderRef: string) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  eventId,
  totalAmount,
  onBack,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elementLoaded, setElementLoaded] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('Processing Payment...');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const pollOrderStatus = async (intentId: string, startTime: number) => {
    const elapsedMs = Date.now() - startTime;
    const MAX_POLL_MS = 15000; // 15-second timeout safeguard

    if (elapsedMs >= MAX_POLL_MS) {
      setIsProcessing(false);
      setWarningMessage(
        'Your payment is processing, but order confirmation is taking longer than expected. Please check your email for your tickets.'
      );
      return;
    }

    try {
      setProcessingStatusText('Confirming your tickets with server...');
      const res = await axios.get(
        `${API_BASE_URL}/api/ticketing/checkout/intent-status/${intentId}?event_id=${eventId}`
      );
      if (
        res.data &&
        (res.data.status === 'completed' || res.data.status === 'succeeded') &&
        res.data.order_ref
      ) {
        window.location.href = `/orders/${res.data.order_ref}`;
        return;
      }
    } catch (e) {
      // Continue polling until timeout
    }

    pollTimerRef.current = setTimeout(() => {
      pollOrderStatus(intentId, startTime);
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      setError('Payment gateway is still initializing. Please wait a moment and try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setWarningMessage(null);
    setProcessingStatusText('Processing Payment...');

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/processing?event_id=${eventId}`,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment confirmation failed. Please check your card details and try again.');
        setIsProcessing(false);
      } else if (paymentIntent) {
        if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
          // Poll with strict 15s timeout
          await pollOrderStatus(paymentIntent.id, Date.now());
        } else if (paymentIntent.status === 'requires_action') {
          // 3D Secure / redirect handled by Stripe
        } else {
          setError(`Payment status: ${paymentIntent.status}. Please try again.`);
          setIsProcessing(false);
        }
      } else {
        // Fallback redirect
        window.location.href = `/orders/processing?event_id=${eventId}`;
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during payment processing.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Loading Skeleton while Stripe iframe mounts */}
      {!elementLoaded && (
        <div className="space-y-3 py-2 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-11 bg-gray-100 rounded-lg border border-gray-200"></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-11 bg-gray-100 rounded-lg border border-gray-200"></div>
            <div className="h-11 bg-gray-100 rounded-lg border border-gray-200"></div>
          </div>
          <p className="text-xs text-gray-400 text-center pt-2">Loading secure payment fields...</p>
        </div>
      )}

      {/* Stripe Payment Element */}
      <div className={elementLoaded ? 'block' : 'opacity-0 h-0 overflow-hidden'}>
        <label className="block text-sm font-bold text-gray-800 mb-2">
          Card Details
        </label>
        <div className="p-3.5 border border-gray-200 rounded-xl bg-gray-50/50 shadow-xs">
          <PaymentElement
            onReady={() => setElementLoaded(true)}
            onChange={(e) => {
              if (e.empty) setError(null);
            }}
            options={{
              layout: 'tabs',
            }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {warningMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="font-medium leading-relaxed">{warningMessage}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Return Home
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/account/tickets'; }}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              View My Tickets
            </button>
          </div>
        </div>
      )}

      <div className="pt-2 space-y-2">
        <button
          type="submit"
          disabled={!stripe || !elements || !elementLoaded || isProcessing}
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3.5 rounded-xl font-bold text-base shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{processingStatusText}</span>
            </>
          ) : (
            `Pay £${totalAmount.toFixed(2)}`
          )}
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={onBack}
          className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition text-center"
        >
          ← Edit contact information
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 pt-1">
        <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span>Encrypted 256-bit Stripe Secure Checkout</span>
      </div>
    </form>
  );
};

interface CheckoutModalProps {
  eventId: string;
  items: { tier_id: string; quantity: number }[];
  promoCode: string | null;
  total: number;
  passFeesToBuyer?: boolean;
  breakdown?: { subtotal: number; bookingFee: number; discount: number };
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  eventId,
  items,
  promoCode,
  total,
  passFeesToBuyer = false,
  breakdown,
  onClose,
}) => {
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState('');
  const [confirmedTotal, setConfirmedTotal] = useState(total);

  const displaySubtotal = breakdown?.subtotal ?? total;
  const displayFee = breakdown?.bookingFee ?? 0;
  const displayDiscount = breakdown?.discount ?? 0;

  const initializeCheckout = async () => {
    if (!buyerName.trim() || !buyerEmail.trim()) {
      setError('Full name and email address are required.');
      return;
    }
    setError('');
    setIsInitializing(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/ticketing/checkout/create-payment-intent`, {
        event_id: eventId,
        items,
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        buyer_phone: buyerPhone.trim(),
        promo_code: promoCode,
      });

      if (res.data.free_order) {
        window.location.href = `/orders/${res.data.order_ref}`;
        return;
      }

      if (res.data.gross_amount !== undefined) {
        setConfirmedTotal(res.data.gross_amount);
      }

      const publishableKey = res.data.publishable_key || defaultStripePubKey;
      if (!publishableKey) {
        setError('Stripe publishable key is missing. Please contact support.');
        setIsInitializing(false);
        return;
      }

      // Initialize Stripe with Connect Account support
      const stripeInstancePromise = loadStripe(
        publishableKey,
        res.data.stripe_account_id ? { stripeAccount: res.data.stripe_account_id } : undefined
      );

      setStripePromise(stripeInstancePromise);
      setClientSecret(res.data.client_secret);
    } catch (err: any) {
      setError(err.response?.data?.detail || err?.message || 'Failed to initialize secure checkout.');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition text-xl"
          aria-label="Close modal"
        >
          &times;
        </button>

        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
            <p className="text-xs text-gray-500 mt-1">
              {clientSecret ? 'Enter payment details to confirm your order' : 'Enter attendee contact details'}
            </p>
          </div>

          {!clientSecret ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  placeholder="e.g. Flora MacDonald"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  placeholder="flora@example.com"
                />
                <p className="text-[11px] text-gray-400 mt-1">Your tickets and QR codes will be sent to this email.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  placeholder="+44 7700 900000"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {error}
                </div>
              )}

              {/* Itemized Order Breakdown */}
              <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>£{displaySubtotal.toFixed(2)}</span>
                </div>

                {displayDiscount > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-600 font-medium">
                    <span>Promo Discount</span>
                    <span>-£{displayDiscount.toFixed(2)}</span>
                  </div>
                )}

                {passFeesToBuyer && displayFee > 0 ? (
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>Booking Fee</span>
                    <span>£{displayFee.toFixed(2)}</span>
                  </div>
                ) : (
                  !passFeesToBuyer && displaySubtotal > 0 && (
                    <div className="flex justify-between items-center text-xs text-gray-400 italic">
                      <span>Booking Fees</span>
                      <span>Included</span>
                    </div>
                  )
                )}

                <div className="flex justify-between items-center text-xl font-bold pt-2 border-t border-gray-100 text-gray-900">
                  <span>Total Amount</span>
                  <span className="text-emerald-700">£{total.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  onClick={initializeCheckout}
                  disabled={isInitializing || !buyerName.trim() || !buyerEmail.trim()}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-base shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isInitializing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Preparing Secure Checkout...</span>
                    </>
                  ) : total === 0 ? (
                    'Claim Free Tickets'
                  ) : (
                    'Continue to Payment'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-base font-bold pb-3 border-b border-gray-100 text-gray-900">
                <span>Total to Pay</span>
                <span className="text-emerald-700 text-lg">£{confirmedTotal.toFixed(2)}</span>
              </div>

              {stripePromise && clientSecret && (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: '#059669',
                        colorBackground: '#ffffff',
                        colorText: '#111827',
                        borderRadius: '10px',
                      },
                    },
                  }}
                >
                  <CheckoutForm
                    eventId={eventId}
                    buyerName={buyerName}
                    buyerEmail={buyerEmail}
                    buyerPhone={buyerPhone}
                    totalAmount={confirmedTotal}
                    onBack={() => {
                      setClientSecret('');
                      setStripePromise(null);
                    }}
                    onSuccess={(orderRef) => {
                      window.location.href = `/orders/${orderRef}`;
                    }}
                  />
                </Elements>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
