import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface Ticket {
  id: string;
  tier_name: string;
  price?: number;
  status: string;
}

interface Order {
  order_id: string;
  order_ref: string;
  event_title: string;
  event_start: string | null;
  event_end: string | null;
  venue_name?: string;
  venue_town?: string;
  venue_address?: string;
  refund_cutoff_hours: number;
  total_amount: number;
  status: string;
  created_at: string;
  tickets: Ticket[];
}

export default function MyTicketsPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refunding, setRefunding] = useState<string | null>(null);

  const fetchOrders = () => {
    apiFetch<{orders: Order[]}>('/api/ticketing/buyer/orders')
      .then(res => setOrders(res.orders || []))
      .catch(err => setError(err.message || 'Failed to load tickets.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchOrders();
    } else if (!authLoading && !isAuthenticated) {
      window.location.href = '/login?returnUrl=/account/tickets';
    }
  }, [isAuthenticated, authLoading]);

  const handleRefund = async (orderId: string) => {
    if (!confirm('Are you sure you want to refund this order? All tickets in this order will be invalidated.')) return;
    
    setRefunding(orderId);
    try {
      await apiFetch(`/api/ticketing/buyer/orders/${orderId}/refund`, {
        method: 'POST'
      });
      alert('Refund processed successfully.');
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Refund request failed.');
    } finally {
      setRefunding(null);
    }
  };

  const isRefundable = (order: Order) => {
    if (order.status !== 'completed' || !order.event_start) return false;
    
    const eventStart = new Date(order.event_start).getTime();
    const now = Date.now();
    const cutoffHours = order.refund_cutoff_hours || 48;
    const cutoffTime = eventStart - (cutoffHours * 60 * 60 * 1000);
    
    return now < cutoffTime;
  };

  const formatEventDate = (startStr: string | null) => {
    if (!startStr) return 'Date TBA';
    const start = new Date(startStr);
    return start.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-stone-600 font-medium">Loading your tickets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4">
      <Head>
        <title>My Tickets - Highland Events Hub</title>
      </Head>
      
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-stone-900">My Tickets</h1>
            <p className="text-sm text-stone-500 mt-1">Manage and download passes for your booked events.</p>
          </div>
          <Link
            href="/events"
            className="text-xs font-bold bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 px-4 py-2 rounded-xl transition shadow-xs"
          >
            + Browse More Events
          </Link>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl mb-6 flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}
        
        <div className="space-y-6">
          {orders.map(order => {
            const refundable = isRefundable(order);
            const isPastEvent = order.event_start ? new Date(order.event_start).getTime() < Date.now() : false;
            const locationString = [order.venue_name, order.venue_town].filter(Boolean).join(', ');
            
            return (
              <div
                key={order.order_id}
                className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden transition hover:shadow-md"
              >
                <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md ${
                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        order.status === 'refunded' ? 'bg-red-100 text-red-800' :
                        'bg-stone-100 text-stone-800'
                      }`}>
                        {order.status}
                      </span>
                      <span className="text-xs font-mono text-stone-400">Ref: {order.order_ref}</span>
                    </div>
                    <h2 className="text-xl font-bold text-stone-900 leading-snug">{order.event_title}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 pt-1">
                      <span>📅 {formatEventDate(order.event_start)}</span>
                      {locationString && <span>📍 {locationString}</span>}
                    </div>
                  </div>
                  
                  <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    <p className="font-extrabold text-xl text-stone-900">£{order.total_amount.toFixed(2)}</p>
                    
                    {order.status === 'completed' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Link 
                          href={`/orders/${order.order_ref}`}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                        >
                          <span>View & Print Tickets 🎟️</span>
                        </Link>
                        
                        {!isPastEvent && refundable && (
                          <button
                            type="button"
                            onClick={() => handleRefund(order.order_id)}
                            disabled={refunding === order.order_id}
                            title="Request a full refund for this order"
                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                          >
                            {refunding === order.order_id ? 'Processing...' : 'Refund'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Tickets list */}
                <div className="bg-stone-50/70 px-6 py-4 border-t border-stone-100">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                      Passes Included ({order.tickets.length})
                    </h4>
                    <Link
                      href={`/orders/${order.order_ref}`}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-bold"
                    >
                      Download All QR Codes →
                    </Link>
                  </div>
                  <ul className="divide-y divide-stone-200/60">
                    {order.tickets.map((t, idx) => (
                      <li key={t.id} className="py-2 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-800">{idx + 1}. {t.tier_name}</span>
                          {t.price !== undefined && t.price > 0 && (
                            <span className="text-stone-400">• £{t.price.toFixed(2)}</span>
                          )}
                        </div>
                        <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${
                          t.status === 'valid' ? 'bg-emerald-100 text-emerald-800' : 
                          t.status === 'checked_in' ? 'bg-blue-100 text-blue-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {t.status === 'checked_in' ? 'Checked In' : 'Valid Pass'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
          
          {orders.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                🎟️
              </div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">No tickets yet</h2>
              <p className="text-stone-500 text-sm max-w-sm mx-auto mb-6">
                You haven't purchased any tickets for upcoming events yet. Once you book, your passes and QR codes will appear right here.
              </p>
              <Link
                href="/events"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition inline-block"
              >
                Browse Events
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
