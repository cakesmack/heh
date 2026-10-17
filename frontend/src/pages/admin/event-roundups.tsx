import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminLayout from '@/components/admin/AdminLayout';
import { RoundupImage, RoundupPoster, type RoundupPosterData } from '@/components/admin/RoundupPoster';
import { adminAPI, locationsAPI } from '@/lib/api';
import { formatDisplayDate } from '@/lib/eventDateDisplay';
import { monthWindow, moveRoundupSelection, posterCategoryColor, roundupRangeLabel, toggleRoundupSelection, upcomingMondayWindow, type RoundupCandidate } from '@/lib/eventRoundups';

// Kept inside AdminGuard so unauthorised visits do not load admin data.
function RoundupTool() {
  const [mode, setMode] = useState<'weekly' | 'location'>('weekly');
  const [range, setRange] = useState(upcomingMondayWindow);
  const [locationId, setLocationId] = useState('');
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [candidates, setCandidates] = useState<RoundupCandidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<RoundupPosterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  const posterRef = useRef<HTMLDivElement>(null);
  const previewContainer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const version = useRef(0);
  const required = Math.min(10, candidates.length);
  const selection = selected.map(id => candidates.find(event => event.id === id)!).filter(Boolean);

  useEffect(() => {
    let active = true;
    locationsAPI.list().then(data => { if (active) setLocations(data); })
      .catch(() => { if (active) setError('Could not load locations. Highlands Weekly remains available; reload to retry locations.'); });
    return () => { active = false; version.current += 1; };
  }, []);
  useEffect(() => {
    if (!preview || !previewContainer.current) return;
    const observer = new ResizeObserver(entries => setScale(Math.min(0.6, entries[0].contentRect.width / 1080)));
    observer.observe(previewContainer.current);
    return () => observer.disconnect();
  }, [preview]);
  const reset = () => {
    version.current += 1; setCandidates([]); setSelected([]); setPreview(null); setLoaded(false); setError(''); setLoading(false); setDiagnostics(null);
  };
  const load = async () => {
    if (!range.start || !range.end || range.start >= range.end) { setError('Choose a valid start and exclusive end date.'); return; }
    if (mode === 'location' && !locationId) { setError('Choose a location first.'); return; }
    const request = ++version.current;
    setLoading(true); setError(''); setLoaded(false); setCandidates([]); setSelected([]); setPreview(null); setDiagnostics(null);
    try {
      const response = await adminAPI.roundupCandidates({ start: `${range.start}T00:00:00`, end: `${range.end}T00:00:00`,
        location_id: mode === 'location' ? Number(locationId) : undefined, diagnostics: diagnosticsEnabled });
      if (request === version.current) { setCandidates(response.candidates); setDiagnostics(response.diagnostics || null); setLoaded(true); }
    } catch (error) {
      if (request === version.current) setError(error instanceof Error ? error.message : 'Could not load candidates.');
    } finally { if (request === version.current) setLoading(false); }
  };
  const generate = () => {
    if (!required || selected.length !== required) { setError(`Select exactly ${required || 10} events first.`); return; }
    setError('');
    setPreview({ events: selection.map(event => ({ ...event })),
      area: mode === 'location' ? locations.find(location => String(location.id) === locationId)?.name || '' : '',
      dateLabel: roundupRangeLabel(range.start, range.end) });
  };
  const download = async () => {
    if (!posterRef.current || !preview || exporting) return;
    setExporting(true); setError('');
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(posterRef.current.querySelectorAll('img')).map(image => image.decode().catch(() => undefined)));
      const fallbackResponse = await fetch('/images/og-preview.jpg');
      if (!fallbackResponse.ok) throw new Error('Could not load the poster fallback image. Please retry.');
      const blob = await fallbackResponse.blob();
      const imagePlaceholder = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      // Same DOM capture/download approach as the existing single-event poster.
      const url = await toPng(posterRef.current, { width: 1080, height: 1350, canvasWidth: 1080, canvasHeight: 1350,
        pixelRatio: 1, cacheBust: true, imagePlaceholder });
      const link = document.createElement('a'); link.download = `heh-popular-events-${range.start}.png`; link.href = url; link.click();
    } catch (error) { setError(error instanceof Error ? `PNG export failed: ${error.message}` : 'PNG export failed. Please retry.'); }
    finally { setExporting(false); }
  };
  const control = 'rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm';
  return <AdminLayout title="Popular Events Posters">
    <p className="text-gray-600 mb-5">Build an editorial roundup from the top 20 public events. Nothing is posted automatically.</p>
    <fieldset disabled={exporting} className="bg-white rounded-xl border p-4 flex flex-wrap items-end gap-4 mb-4">
      <label className="grid gap-1 text-sm font-medium">Roundup type<select className={control} value={mode} onChange={event => { reset(); setMode(event.target.value as typeof mode); setRange(upcomingMondayWindow()); }}>
        <option value="weekly">Highlands Weekly</option><option value="location">Location Roundup</option>
      </select></label>
      {mode === 'location' && <>
        <label className="grid gap-1 text-sm font-medium">Location<select className={control} value={locationId} onChange={event => { reset(); setLocationId(event.target.value); }}><option value="">Choose location</option>{locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Set a month<input className={control} type="month" onChange={event => { if (event.target.value) { reset(); setRange(monthWindow(event.target.value)); } }} /></label>
      </>}
      <label className="grid gap-1 text-sm font-medium">Start (London)<input className={control} type="date" value={range.start} readOnly={mode === 'weekly'} onChange={event => { reset(); setRange(previous => ({ ...previous, start: event.target.value })); }} /></label>
      <label className="grid gap-1 text-sm font-medium">End (exclusive)<input className={control} type="date" value={range.end} readOnly={mode === 'weekly'} onChange={event => { reset(); setRange(previous => ({ ...previous, end: event.target.value })); }} /></label>
      <button type="button" className="bg-emerald-800 text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Find top 20'}</button>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={diagnosticsEnabled} onChange={event => { setDiagnosticsEnabled(event.target.checked); setDiagnostics(null); }} />Temporary diagnostic counts</label>
    </fieldset>
    <p className="text-sm text-gray-600 mb-3">{range.start && range.end && range.start < range.end ? roundupRangeLabel(range.start, range.end) : 'Choose a valid range'} · London-local starts, inclusive start / exclusive end. Location uses the public Events search matcher, including primary/participating venues and event location fields.</p>
    {diagnostics && <div role="status" className="bg-gray-100 border rounded-lg p-3 mb-4 text-sm"><p className="font-semibold">Diagnostic counts before venue grouping/top-20 limit · location ID {mode === 'location' ? locationId : 'all'}</p><dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">{Object.entries(diagnostics).map(([name, value]) => <div key={name} className="flex justify-between gap-3"><dt>{name.replaceAll('_', ' ')}</dt><dd className="font-mono">{value}</dd></div>)}</dl></div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-800 p-3 mb-4">{error}</p>}
    {loaded && <p role="status" className="mb-4 text-sm text-gray-700">{candidates.length} eligible candidates found.{candidates.length < 20 && ' Fewer than 20 qualified.'}{candidates.length > 0 && candidates.length < 10 && ` Only ${candidates.length} are available: select all ${candidates.length} for this smaller roundup.`}{!candidates.length && ' Try another range or location.'}</p>}
    <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
      <fieldset disabled={exporting} className="space-y-3 min-w-0">
        {candidates.map(event => <label key={event.id} className={`flex gap-3 p-3 rounded-xl border bg-white cursor-pointer ${selected.includes(event.id) ? 'border-emerald-600 ring-1 ring-emerald-600' : 'border-gray-200'}`}>
          <input type="checkbox" aria-label={`Select ${event.title}`} checked={selected.includes(event.id)} disabled={!selected.includes(event.id) && selected.length >= 10} onChange={() => { setSelected(previous => toggleRoundupSelection(previous, event.id)); setPreview(null); }} />
          <RoundupImage event={event} style={{ width: 64, height: 64, borderRadius: 8, flexShrink: 0 }} />
          <div className="min-w-0 text-sm"><h2 className="font-bold break-words">{event.title}</h2>
            <p>{formatDisplayDate(event.date_start, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-gray-600">{event.venue_name || 'Venue to be confirmed'}{event.town ? ` · ${event.town}` : ''}</p>
            <span className="text-xs border-l-4 pl-2" style={{ borderColor: posterCategoryColor(event.category_color) }}>{event.category_name || 'Event'}</span>
            <p className="text-xs text-gray-500 mt-1">Views {event.view_count} · Website clicks {event.website_click_count} · Ticket clicks {event.ticket_click_count} · <strong>Score {event.popularity_score}</strong></p>
          </div>
        </label>)}
      </fieldset>
      <section className="bg-white border rounded-xl p-4 xl:sticky xl:top-4">
        <h2 className="font-bold" aria-live="polite">Selected: {selected.length} / 10</h2>
        <p className="text-xs text-gray-500 mt-1 mb-3">Poster order follows your selection. Move entries before generating.</p>
        <ol className="space-y-2">{selection.map((event, index) => <li key={event.id} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 break-words">{index + 1}. {event.title}</span>
          <button className="border rounded px-2 py-1 disabled:opacity-30" aria-label={`Move ${event.title} up`} disabled={exporting || index === 0} onClick={() => { setSelected(previous => moveRoundupSelection(previous, index, -1)); setPreview(null); }}>↑</button>
          <button className="border rounded px-2 py-1 disabled:opacity-30" aria-label={`Move ${event.title} down`} disabled={exporting || index === selected.length - 1} onClick={() => { setSelected(previous => moveRoundupSelection(previous, index, 1)); setPreview(null); }}>↓</button>
          <button className="text-red-700 px-1" aria-label={`Remove ${event.title}`} disabled={exporting} onClick={() => { setSelected(previous => previous.filter(id => id !== event.id)); setPreview(null); }}>×</button>
        </li>)}</ol>
        <button className="w-full mt-4 bg-emerald-800 text-white rounded-lg px-4 py-2 disabled:opacity-40" disabled={exporting || !required || selected.length !== required} onClick={generate}>Generate / refresh preview</button>
      </section>
    </div>
    {preview && <section className="mt-6 bg-gray-100 border rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="font-bold">Poster preview · 1080 × 1350</h2><button disabled={exporting} onClick={download} className="bg-emerald-800 text-white px-4 py-2 rounded-lg disabled:opacity-50">{exporting ? 'Exporting…' : 'Download PNG'}</button></div>
      <p className="text-sm text-gray-600 mb-4">Missing/unavailable images use the HEH fallback. External image hosts that block export may also use this fallback in the PNG.</p>
      <div ref={previewContainer} className="max-w-[648px] mx-auto"><div style={{ width: 1080 * scale, height: 1350 * scale }}><div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}><RoundupPoster ref={posterRef} {...preview} /></div></div></div>
    </section>}
  </AdminLayout>;
}

export default function EventRoundupsPage() { return <AdminGuard><RoundupTool /></AdminGuard>; }
