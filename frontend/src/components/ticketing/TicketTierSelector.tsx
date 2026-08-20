import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/api';

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity_available: number;
  quantity_sold: number;
  max_per_order: number;
  sale_start?: string | null;
  sale_end?: string | null;
  is_hidden: boolean;
}

interface TicketTierSelectorProps {
  eventId: string;
  tiers: TicketTier[];
  eventDateStart?: string | null;
  passFeesToBuyer?: boolean;
  onProceed: (
    items: { tier_id: string; quantity: number }[],
    promoCode: string | null,
    total: number,
    breakdown?: { subtotal: number; bookingFee: number; discount: number }
  ) => void;
}

export const TicketTierSelector: React.FC<TicketTierSelectorProps> = ({
  eventId,
  tiers,
  eventDateStart,
  passFeesToBuyer = false,
  onProceed,
}) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState('');
  const [promoValid, setPromoValid] = useState<{ discount_type: string; discount_value: number; target_tier_id: string | null } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setIsValidatingPromo(true);
    setPromoError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/ticketing/checkout/events/${eventId}/validate-promo`, { code: promoCode });
      setPromoValid(res.data);
    } catch (err: any) {
      setPromoValid(null);
      setPromoError(err.response?.data?.detail || 'Invalid promo code');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleIncrement = (tier: TicketTier) => {
    const current = quantities[tier.id] || 0;
    const remaining = tier.quantity_available - tier.quantity_sold;
    if (current < tier.max_per_order && current < remaining) {
      setQuantities({ ...quantities, [tier.id]: current + 1 });
    }
  };

  const handleDecrement = (tier: TicketTier) => {
    const current = quantities[tier.id] || 0;
    if (current > 0) {
      setQuantities({ ...quantities, [tier.id]: current - 1 });
    }
  };

  const { subtotal, discount, discountedSubtotal, bookingFee, grandTotal, totalItems, paidItemsCount } = useMemo(() => {
    let sub = 0;
    let items = 0;
    let paidCount = 0;

    tiers.forEach((t) => {
      const q = quantities[t.id] || 0;
      sub += t.price * q;
      items += q;
      if (t.price > 0) {
        paidCount += q;
      }
    });

    let d = 0;
    if (promoValid) {
      if (promoValid.discount_type === 'percentage') {
        d = (sub * promoValid.discount_value) / 100;
      } else if (promoValid.discount_type === 'fixed_amount') {
        d = promoValid.discount_value;
      }
      d = Math.min(d, sub);
    }

    const discounted = Math.max(0, sub - d);

    // Dynamic fee estimation (3.5% + £0.30 per ticket)
    let fee = 0;
    if (passFeesToBuyer && discounted > 0 && paidCount > 0) {
      const estimatedFee = (discounted * 0.035) + (0.30 * paidCount);
      fee = Number(Math.min(75.0, estimatedFee).toFixed(2));
    }

    const total = passFeesToBuyer ? Number((discounted + fee).toFixed(2)) : discounted;

    return {
      subtotal: sub,
      discount: d,
      discountedSubtotal: discounted,
      bookingFee: fee,
      grandTotal: total,
      totalItems: items,
      paidItemsCount: paidCount,
    };
  }, [quantities, promoValid, tiers, passFeesToBuyer]);

  const visibleTiers = tiers.filter((t) => {
    if (!t.is_hidden) return true;
    if (promoValid && promoValid.target_tier_id === t.id) return true;
    return false;
  });

  const selectedItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([tier_id, quantity]) => ({ tier_id, quantity }));
  }, [quantities]);

  return (
    <div className="bg-white text-gray-900 p-6 rounded-2xl shadow-xl w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Select Tickets</h2>

      <div className="space-y-4 mb-8">
        {visibleTiers.map((tier) => {
          const remaining = tier.quantity_available - tier.quantity_sold;
          const current = quantities[tier.id] || 0;
          const isSoldOut = remaining <= 0;
          
          const cutoff = tier.sale_end || eventDateStart;
          const isSalesClosed = cutoff ? new Date(cutoff).getTime() < Date.now() : false;
          const isSalesNotStarted = tier.sale_start ? new Date(tier.sale_start).getTime() > Date.now() : false;

          return (
            <div key={tier.id} className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-semibold text-base text-gray-900">{tier.name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-gray-700 text-sm font-semibold">
                    {tier.price === 0 ? 'Free' : `£${tier.price.toFixed(2)}`}
                  </span>
                  {passFeesToBuyer && tier.price > 0 && (
                    <span className="text-[11px] text-emerald-600 font-medium">(+ fee)</span>
                  )}
                </div>
                {remaining < 10 && !isSoldOut && !isSalesClosed && !isSalesNotStarted && (
                  <p className="text-amber-600 text-xs mt-1 font-medium">Only {remaining} left!</p>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {isSalesClosed ? (
                  <span className="text-red-700 font-bold bg-red-50 border border-red-200 px-2.5 py-1 rounded text-xs uppercase tracking-wider">Sales Closed</span>
                ) : isSalesNotStarted ? (
                  <span className="text-stone-600 font-semibold bg-stone-100 px-3 py-1 rounded text-xs">Coming Soon</span>
                ) : isSoldOut ? (
                  <span className="text-red-600 font-semibold bg-red-50 px-3 py-1 rounded text-xs">Sold Out</span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDecrement(tier)}
                      disabled={current === 0}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold hover:bg-gray-200 disabled:opacity-30 transition"
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-bold text-sm">{current}</span>
                    <button
                      type="button"
                      onClick={() => handleIncrement(tier)}
                      disabled={current >= tier.max_per_order || current >= remaining}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold hover:bg-gray-200 disabled:opacity-30 transition"
                    >
                      +
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {visibleTiers.length === 0 && (
          <p className="text-gray-500 italic text-sm">No tickets currently available.</p>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Promo Code</label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e.target.value.toUpperCase());
              setPromoValid(null);
              setPromoError('');
            }}
            placeholder="ENTER CODE"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono uppercase"
          />
          <button
            type="button"
            onClick={handleApplyPromo}
            disabled={!promoCode || isValidatingPromo}
            className="bg-stone-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-stone-800 disabled:opacity-50 transition"
          >
            {isValidatingPromo ? 'Checking...' : 'Apply'}
          </button>
        </div>
        {promoError && <p className="text-red-500 text-xs mt-1 font-medium">{promoError}</p>}
        {promoValid && <p className="text-emerald-600 text-xs mt-1 font-medium">✓ Promo code applied successfully!</p>}
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-2">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Subtotal</span>
          <span>£{subtotal.toFixed(2)}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between items-center text-sm text-emerald-600 font-medium">
            <span>Discount</span>
            <span>-£{discount.toFixed(2)}</span>
          </div>
        )}

        {passFeesToBuyer && bookingFee > 0 && (
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Booking Fee</span>
            <span>£{bookingFee.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-lg font-bold text-gray-900">
          <span>Total Amount</span>
          <span>£{grandTotal.toFixed(2)}</span>
        </div>

        {!passFeesToBuyer && subtotal > 0 && (
          <p className="text-[11px] text-gray-400 text-right">All booking fees included</p>
        )}

        <button
          type="button"
          disabled={totalItems === 0}
          onClick={() =>
            onProceed(selectedItems, promoValid ? promoCode : null, grandTotal, {
              subtotal: discountedSubtotal,
              bookingFee,
              discount,
            })
          }
          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-base shadow-sm transition disabled:opacity-40"
        >
          {totalItems === 0 ? 'Select Tickets to Continue' : 'Proceed to Checkout'}
        </button>
      </div>
    </div>
  );
};
