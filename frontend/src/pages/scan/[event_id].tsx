import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { API_BASE_URL } from '@/lib/api';

interface ScanFeedback {
  status: 'valid' | 'already_used' | 'invalid' | null;
  message?: string;
  ticket_id?: string;
  buyer_name?: string;
  tier_name?: string;
  order_ref?: string;
  checked_in_at?: string;
  checked_in_by?: string;
}

export default function DoorScannerPage() {
  const router = useRouter();
  const { event_id, token } = router.query;
  const [activeTab, setActiveTab] = useState<'scan' | 'manual' | 'guestlist'>('scan');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ total_sold: 0, checked_in: 0, title: '' });
  
  const [feedback, setFeedback] = useState<ScanFeedback>({ status: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Manual code input
  const [manualCode, setManualCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Sound effects helper using AudioContext
  const playBeep = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.1); // D6
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.setValueAtTime(200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch {
      // Audio context might not be allowed before user interaction
    }
  };

  // Validate Scanner Key on Mount
  useEffect(() => {
    if (!event_id || !token) return;
    
    axios.post(`${API_BASE_URL}/api/ticketing/scan/validate-key`, { event_id, token })
      .then(res => {
        setIsAuthorized(true);
        setStats({
          total_sold: res.data.total_sold,
          checked_in: res.data.total_checked_in,
          title: res.data.event_title
        });
      })
      .catch(() => {
        setIsAuthorized(false);
      });
  }, [event_id, token]);

  const processTicketScan = async (code: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const res = await axios.post(`${API_BASE_URL}/api/ticketing/scan/validate-ticket`, {
        event_id,
        token,
        qr_token: code,
        device_id: 'Door Scanner'
      });
      
      setFeedback(res.data);
      
      if (res.data.status === 'valid') {
        setStats(s => ({ ...s, checked_in: s.checked_in + 1 }));
        playBeep('success');
        if (navigator.vibrate) navigator.vibrate(200);
      } else {
        playBeep('error');
        if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
      }
      
      setTimeout(() => {
        setFeedback({ status: null });
        setIsProcessing(false);
      }, 3500);
      
    } catch {
      setFeedback({ status: 'invalid', message: 'Connection error or invalid scanner session.' });
      playBeep('error');
      setTimeout(() => {
        setFeedback({ status: null });
        setIsProcessing(false);
      }, 3000);
    }
  };

  // Setup HTML5 Scanner
  useEffect(() => {
    if (isAuthorized && activeTab === 'scan' && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        "reader", 
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 }, 
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] 
        }, 
        false
      );
      
      scannerRef.current = scanner;
      
      scanner.render(
        (decodedText) => {
          processTicketScan(decodedText);
        },
        () => {
          // Continuous scan frame callback
        }
      );
    }
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isAuthorized, activeTab, isProcessing, event_id, token]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setManualLoading(true);
    await processTicketScan(manualCode.trim());
    setManualLoading(false);
    setManualCode('');
  };

  if (isAuthorized === null) {
    return (
      <div className="p-8 text-center bg-stone-950 text-stone-300 min-h-screen flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-sm">Authenticating secure scanner session...</p>
      </div>
    );
  }
  
  if (isAuthorized === false) {
    return (
      <div className="p-8 text-center bg-stone-950 text-white min-h-screen flex items-center justify-center">
        <div className="max-w-md bg-stone-900 border border-stone-800 p-8 rounded-3xl text-center space-y-4">
          <div className="text-5xl">⛔</div>
          <h1 className="text-2xl font-extrabold text-red-500">Scanner Inactive or Key Invalid</h1>
          <p className="text-stone-400 text-sm">
            This scanner session is not active. Please ask the event organizer to activate the event scanner from the Highland Events Hub Scanner Hub.
          </p>
          <div className="pt-2">
            <Link
              href="/organizers/scanner"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition"
            >
              Go to Scanner Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const percent = stats.total_sold > 0 ? Math.round((stats.checked_in / stats.total_sold) * 100) : 0;

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col font-sans select-none">
      <Head>
        <title>Gate Scanner: {stats.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      
      {/* Top Header */}
      <div className="bg-stone-900 border-b border-stone-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Gate Check-In</span>
          </div>
          <h1 className="text-sm font-extrabold truncate text-stone-100">{stats.title}</h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 text-right">
            <div className="text-xs font-black text-emerald-400">
              {stats.checked_in} <span className="text-stone-500 font-normal">/ {stats.total_sold}</span>
            </div>
            <div className="text-[10px] text-stone-400 font-medium">{percent}% checked in</div>
          </div>

          <Link
            href="/organizers/scanner"
            className="text-stone-400 hover:text-stone-200 text-xs font-bold px-2 py-1 bg-stone-800 rounded-lg"
            title="Exit to Hub"
          >
            ✕ Exit
          </Link>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex bg-stone-900 border-b border-stone-800 text-xs font-black tracking-wider">
        <button 
          onClick={() => setActiveTab('scan')} 
          className={`flex-1 py-3.5 text-center transition ${
            activeTab === 'scan' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-stone-800/50' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          📷 CAMERA SCAN
        </button>
        <button 
          onClick={() => setActiveTab('manual')} 
          className={`flex-1 py-3.5 text-center transition ${
            activeTab === 'manual' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-stone-800/50' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          ⌨️ MANUAL CODE
        </button>
        <button 
          onClick={() => setActiveTab('guestlist')} 
          className={`flex-1 py-3.5 text-center transition ${
            activeTab === 'guestlist' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-stone-800/50' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          📋 GUEST LIST
        </button>
      </div>
      
      {/* Tab Body */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Visual Feedback Overlays */}
        {feedback.status === 'valid' && (
          <div className="absolute inset-0 z-40 bg-emerald-600 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="text-7xl mb-3">✓</div>
            <h2 className="text-3xl font-black text-white mb-1">VALID TICKET</h2>
            <p className="text-2xl font-bold text-white mb-1">{feedback.buyer_name}</p>
            <span className="inline-block bg-emerald-800 text-emerald-100 text-sm font-bold px-3 py-1 rounded-full mb-4">
              {feedback.tier_name}
            </span>
            <p className="text-xs font-mono text-emerald-200 opacity-90">REF: {feedback.order_ref}</p>
          </div>
        )}
        
        {feedback.status === 'already_used' && (
          <div className="absolute inset-0 z-40 bg-red-600 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="text-7xl mb-3">✕</div>
            <h2 className="text-3xl font-black text-white mb-1">ALREADY CHECKED IN</h2>
            <p className="text-lg font-bold text-white mb-2">{feedback.buyer_name}</p>
            {feedback.checked_in_at && (
              <p className="text-xs bg-red-800 text-red-100 px-3 py-1.5 rounded-lg mb-2">
                Checked in at: {new Date(feedback.checked_in_at).toLocaleTimeString('en-GB')}
              </p>
            )}
            <p className="text-xs font-mono text-red-200 opacity-80">REF: {feedback.order_ref}</p>
          </div>
        )}
        
        {feedback.status === 'invalid' && (
          <div className="absolute inset-0 z-40 bg-stone-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
            <div className="text-7xl mb-3 text-stone-500">❓</div>
            <h2 className="text-2xl font-black text-red-400 mb-2">INVALID TICKET</h2>
            <p className="text-stone-300 text-sm max-w-xs">{feedback.message || 'Ticket code not found for this event.'}</p>
          </div>
        )}

        {/* Camera Scan Tab */}
        {activeTab === 'scan' && (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-stone-800 shadow-2xl bg-black">
              <div id="reader" className="w-full min-h-[300px]"></div>
            </div>
            <p className="text-stone-400 text-xs text-center mt-4 max-w-xs">
              Point your camera at an attendee's digital QR pass or printed physical ticket.
            </p>
          </div>
        )}

        {/* Manual Code Lookup Tab */}
        {activeTab === 'manual' && (
          <div className="flex-1 p-6 max-w-md mx-auto w-full space-y-6">
            <div className="bg-stone-900 border border-stone-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-stone-100">Manual Code Entry</h3>
              <p className="text-xs text-stone-400">
                Type or paste an Order Reference (e.g. <code>HEH-8F0EF1</code>) or Ticket ID to validate and check in.
              </p>

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Enter HEH-XXXXXX or Ticket ID"
                  className="w-full bg-stone-950 border border-stone-700 text-white rounded-xl px-4 py-3 text-sm font-mono focus:border-emerald-500 focus:outline-hidden"
                  autoFocus
                />

                <button
                  type="submit"
                  disabled={manualLoading || !manualCode.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-sm transition disabled:opacity-50"
                >
                  {manualLoading ? 'Checking...' : 'Check In Attendee →'}
                </button>
              </form>
            </div>
          </div>
        )}
        
        {/* Guest List Tab */}
        {activeTab === 'guestlist' && (
          <div className="flex-1 overflow-y-auto">
            <GuestListTab
              eventId={event_id as string}
              token={token as string}
              onCheckedIn={() => {
                setStats(s => ({ ...s, checked_in: s.checked_in + 1 }));
                playBeep('success');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Guest List Sub-Component
const GuestListTab = ({ eventId, token, onCheckedIn }: { eventId: string; token: string; onCheckedIn: () => void }) => {
  const [guests, setGuests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  
  const loadGuests = () => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/ticketing/scan/guest-list?event_id=${eventId}&token=${token}&search=${encodeURIComponent(search)}`)
      .then(res => setGuests(res.data.guests || []))
      .finally(() => setLoading(false));
  };
  
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadGuests();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [search, eventId, token]);
  
  const handleManualCheckIn = async (ticketId: string, name: string) => {
    if (!confirm(`Confirm manual check-in for "${name}"?`)) return;
    setCheckingInId(ticketId);
    try {
      await axios.post(`${API_BASE_URL}/api/ticketing/scan/manual-check-in`, {
        event_id: eventId,
        token,
        ticket_id: ticketId
      });
      loadGuests();
      onCheckedIn();
    } catch {
      alert('Check-in failed.');
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <input 
        type="text" 
        placeholder="🔍 Search attendee name or order ref..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-stone-900 border border-stone-800 text-white rounded-xl px-4 py-3 text-xs focus:border-emerald-500 focus:outline-hidden"
      />
      
      {loading ? (
        <div className="p-8 text-center text-stone-500 text-xs">Loading attendees...</div>
      ) : (
        <div className="space-y-2.5">
          {guests.map(g => (
            <div
              key={g.ticket_id}
              className={`p-4 rounded-xl flex items-center justify-between gap-3 ${
                g.status === 'checked_in'
                  ? 'bg-stone-900/40 border border-stone-800/40 opacity-50'
                  : 'bg-stone-900 border border-stone-800'
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-extrabold text-sm text-stone-100">{g.buyer_name}</p>
                <p className="text-xs text-stone-400">
                  {g.tier_name} • <span className="font-mono text-stone-500 text-[11px]">{g.order_ref}</span>
                </p>
                {g.status === 'checked_in' && (
                  <p className="text-[10px] text-emerald-400 font-bold">
                    ✓ Checked in at {new Date(g.checked_in_at).toLocaleTimeString('en-GB')}
                  </p>
                )}
              </div>
              
              {g.status !== 'checked_in' && (
                <button 
                  onClick={() => handleManualCheckIn(g.ticket_id, g.buyer_name)}
                  disabled={checkingInId === g.ticket_id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black transition disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {checkingInId === g.ticket_id ? 'Checking...' : 'Check In ✓'}
                </button>
              )}
            </div>
          ))}

          {guests.length === 0 && (
            <div className="text-center py-12 text-stone-500 text-xs">
              No matching tickets found on the guest list.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
