import React from 'react';
import Link from 'next/link';

interface LeadGenBlockProps {
  city: string;
}

export function LeadGenBlock({ city }: LeadGenBlockProps) {
  const formattedCity = city.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 py-14 px-6 md:px-12 text-center mt-10">
      {/* Decorative Shapes */}
      <div className="absolute top-0 left-0 w-40 h-40 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-56 h-56 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/[0.03] rounded-full" />

      <div className="relative z-10">
        {/* Icon */}
        <div className="mx-auto w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-5 shadow-lg">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
          Know of an event in {formattedCity}?
        </h2>
        <p className="text-emerald-100 text-base md:text-lg max-w-md mx-auto mb-7">
          Help your community discover what's happening. Add your local event and reach hundreds of attendees.
        </p>

        <Link
          href="/submit-event"
          className="inline-flex items-center gap-2 bg-white text-emerald-700 font-bold py-3.5 px-8 rounded-full hover:bg-emerald-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-base"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          List Your Event — It's Free
        </Link>
      </div>
    </section>
  );
}
