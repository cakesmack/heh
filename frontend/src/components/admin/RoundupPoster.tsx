import { forwardRef, useState, type CSSProperties } from 'react';
import { formatDisplayDate } from '@/lib/eventDateDisplay';
import { posterCategoryColor, type RoundupCandidate } from '@/lib/eventRoundups';
import { optimizeImage } from '@/utils/imageOptimizer';

export function RoundupImage({ event, style }: { event: RoundupCandidate; style?: CSSProperties }) {
  const fallback = '/images/og-preview.jpg';
  const [failed, setFailed] = useState(false);
  return <img src={failed ? fallback : optimizeImage(event.image_url, 'thumb') || fallback}
    alt="" onError={() => setFailed(true)} style={{ objectFit: 'cover', ...style }} />;
}

export interface RoundupPosterData { events: RoundupCandidate[]; area: string; dateLabel: string }

/** Fixed-size HTML template, captured with the existing html-to-image exporter. */
export const RoundupPoster = forwardRef<HTMLDivElement, RoundupPosterData>(function RoundupPoster({ events, area, dateLabel }, ref) {
  return <div ref={ref} style={{ width: 1080, height: 1350, boxSizing: 'border-box', padding: 36,
    background: 'radial-gradient(ellipse at top right, #14543e 0%, #0B3B2C 30%, #101c19 75%)',
    color: '#fff', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', position: 'relative', isolation: 'isolate' }}>
    <img src="/images/logo-white.png" alt="" aria-hidden="true" style={{ position: 'absolute', width: 470, height: 470, objectFit: 'contain',
      right: -95, top: -135, opacity: 0.045, transform: 'rotate(-14deg)', pointerEvents: 'none', zIndex: 0 }} />
    <header style={{ height: area ? 190 : 166, flexShrink: 0, position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <img src="/images/logo-white.png" alt="" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 25, lineHeight: '29px', fontWeight: 800, letterSpacing: -0.5 }}>Highland Events Hub</div>
          <div style={{ color: '#86efac', fontSize: 11, lineHeight: '18px', letterSpacing: 2, marginTop: 2 }}>YOUR HIGHLANDS EVENTS GUIDE</div>
        </div>
      </div>
      <h1 style={{ margin: 0, fontSize: 43, fontWeight: 900, lineHeight: 1.04, letterSpacing: -1 }}>TOP HIGHLAND EVENTS THIS WEEK</h1>
      <div style={{ fontSize: 27, lineHeight: '32px', fontWeight: 700, marginTop: 8, color: '#a7f3d0', letterSpacing: 0.2 }}>{dateLabel}</div>
      {area && <div style={{ fontSize: 18, lineHeight: '22px', fontWeight: 700, color: '#bdcfc7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 4 }}>
        {`IN ${area.toUpperCase()}`}
      </div>}
    </header>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1 }}>
      {events.map((event, index) => {
        const color = posterCategoryColor(event.category_color);
        return <div key={event.id} style={{ display: 'flex', gap: 12, alignItems: 'center', height: 92, boxSizing: 'border-box',
          background: 'linear-gradient(110deg, #ffffff18, #ffffff0b)', border: '1px solid #ffffff28', borderRadius: 14,
          borderLeft: `5px solid ${color}`,
          boxShadow: 'inset 0 1px 0 #ffffff08',
          padding: '5px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: 128, height: 80, flexShrink: 0 }}>
            <div style={{ position: 'absolute', right: 0, top: -1, width: 82, height: 82, boxSizing: 'border-box', borderRadius: 10, overflow: 'hidden', border: '1px solid #ffffff24', background: '#0a241b' }}>
              <RoundupImage event={event} style={{ width: '100%', height: '100%', opacity: 0.9 }} />
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #081d17a0, transparent 55%)' }} />
            </div>
            <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, zIndex: 1, fontSize: 64, lineHeight: '80px',
              fontWeight: 900, fontStyle: 'italic', letterSpacing: -5, color: '#ffffff08', WebkitTextStroke: '1.4px rgba(255,255,255,0.36)', opacity: 0.75 }}>{index + 1}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 23, fontWeight: 800, lineHeight: '26px', maxHeight: 52, letterSpacing: -0.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}>{event.title}</div>
            <div style={{ fontSize: 15, lineHeight: '20px', color: '#bdcfc7', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatDisplayDate(event.date_start, { day: 'numeric', month: 'short' })}, {formatDisplayDate(event.date_start, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} · {event.venue_name || 'Venue to be confirmed'}{event.town ? ` · ${event.town}` : ''}
            </div>
          </div>
          <span style={{ width: 166, flexShrink: 0, fontSize: 12, lineHeight: '16px', fontWeight: 700, borderRadius: 999,
            padding: '8px 12px', boxSizing: 'border-box', background: `${color}20`, border: `1px solid ${color}`, color: '#fff',
            maxHeight: 50, overflow: 'hidden', overflowWrap: 'anywhere', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{event.category_name || 'Event'}</span>
        </div>;
      })}
    </div>
    <footer style={{ height: 64, boxSizing: 'border-box', flexShrink: 0, position: 'relative', zIndex: 1, borderTop: '1px solid #ffffff24', paddingTop: 12 }}>
      <div style={{ fontSize: 25, lineHeight: '29px', fontWeight: 800, letterSpacing: -0.3, color: '#86efac' }}>highlandeventshub.co.uk</div>
      <div style={{ fontSize: 12, lineHeight: '17px', color: '#9eb7ac', marginTop: 4 }}>Popular upcoming events based on views and ticket/website clicks on Highland Events Hub</div>
    </footer>
  </div>;
});
