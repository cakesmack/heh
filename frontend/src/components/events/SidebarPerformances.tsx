import React, { useState } from 'react';

interface SidebarPerformancesProps {
  showtimes: any[];
  eventTicketUrl?: string;
  eventId: string;
  trackTicketClick: (id: string) => void;
}

const DISPLAY_LIMIT = 4;

export default function SidebarPerformances({
  showtimes,
  eventTicketUrl,
  eventId,
  trackTicketClick,
}: SidebarPerformancesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. Filter out past performances (end_time > now, or start_time if end is unavailable)
  // 2. Sort chronologically from earliest to latest
  const now = new Date();
  const upcomingPerformances = (showtimes || [])
    .filter((st: any) => {
      const timeToCompare = st.end_time ? new Date(st.end_time) : new Date(st.start_time);
      return timeToCompare > now;
    })
    .sort((a: any, b: any) => {
      const aTime = new Date(a.start_time).getTime();
      const bTime = new Date(b.start_time).getTime();
      return aTime - bTime;
    });

  // Handle empty state
  if (upcomingPerformances.length === 0) {
    return (
      <div className="py-2">
        <p className="text-sm text-gray-500 italic">There are no upcoming dates for this event.</p>
      </div>
    );
  }

  const displayedPerformances = isExpanded
    ? upcomingPerformances
    : upcomingPerformances.slice(0, DISPLAY_LIMIT);

  return (
    <div className="space-y-4">
      <div className="divide-y divide-gray-100">
        {displayedPerformances.map((st: any, index: number) => {
          const stDate = new Date(st.start_time);
          const stEndDate = st.end_time ? new Date(st.end_time) : null;
          const ticketUrl = st.ticket_url || eventTicketUrl;
          return (
            <div key={st.id || index} className="flex items-center justify-between py-3 first:pt-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">
                    {stDate.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <span className="text-lg font-bold text-emerald-900 leading-none">
                    {stDate.getDate()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {stDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {stEndDate && ` - ${stEndDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                  {st.notes && (
                    <p className="text-xs text-amber-600 font-medium mt-0.5">{st.notes}</p>
                  )}
                </div>
              </div>
              <a
                href={ticketUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => ticketUrl && trackTicketClick(eventId)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
                  ticketUrl
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Buy Tickets
              </a>
            </div>
          );
        })}
      </div>

      {upcomingPerformances.length > DISPLAY_LIMIT && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 text-center text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
        >
          {isExpanded ? 'Show fewer dates' : `Show all ${upcomingPerformances.length} dates`}
        </button>
      )}
    </div>
  );
}
