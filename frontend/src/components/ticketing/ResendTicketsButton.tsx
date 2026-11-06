import React, { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function ResendTicketsButton({ orderId, role = 'organizer' }: {
  orderId: string;
  role?: 'organizer' | 'admin';
}) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const resend = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      const prefix = role === 'admin' ? '/api/admin/ticketing' : '/api/ticketing/organizer';
      const result = await apiFetch<{ message: string }>(`${prefix}/orders/${encodeURIComponent(orderId)}/resend-tickets`, {
        method: 'POST',
      });
      setMessage(result.message);
    } catch (error: any) {
      setFailed(true);
      setMessage(error?.message || 'Unable to resend tickets. Please try again later.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <button type="button" onClick={resend} disabled={busy} aria-busy={busy}
        className="px-2.5 py-1 rounded text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 disabled:cursor-wait">
        {busy ? 'Resending…' : 'Resend tickets'}
      </button>
      {message && <p role={failed ? 'alert' : 'status'} className={`text-xs mt-1 ${failed ? 'text-red-700' : 'text-emerald-700'}`}>{message}</p>}
    </div>
  );
}
