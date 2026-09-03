import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Check,
  X as LucideX,
  Zap,
  ShieldCheck,
  CreditCard,
  QrCode,
  Calendar,
  ChevronDown,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Banknote,
  Users,
  Smartphone,
  Flame,
} from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'How do payouts work?',
    answer:
      'Payouts process automatically through Stripe. When an attendee buys a ticket, funds route directly to your connected UK bank account. Highland Events Hub never holds your revenue.',
  },
  {
    question: 'What equipment do I need on the door?',
    answer:
      'No hired hardware or app store downloads are required. Log into the Hub on any mobile browser to use the built-in smartphone QR scanner, or download a printable PDF check-in list with attendee names and codes.',
  },
  {
    question: 'What fees do attendees see?',
    answer:
      'Pricing is completely transparent. You can choose whether to absorb the small platform fee into the face-value ticket price or display it cleanly to the ticket buyer at checkout.',
  },
  {
    question: 'Who handles refunds or event cancellations?',
    answer:
      'Organizers retain direct control over ticket inventory and can trigger single or bulk refunds directly from their dashboard.',
  },
];

export default function SellTicketsPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const scrollToComparison = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById('comparison');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Head>
        <title>Sell Tickets Online | Highland Events Hub</title>
        <meta
          name="description"
          content="Sell tickets directly to Highland audiences with lower booking fees, instant Stripe payouts, and regional discovery built specifically for Scotland."
        />
        <meta property="og:title" content="Sell Tickets Directly | Highland Events Hub" />
        <meta
          property="og:description"
          content="Keep more revenue with lower fees, direct Stripe bank payouts, and 100% Highland-focused discovery."
        />
        <meta property="og:url" content="https://highlandeventshub.co.uk/sell-tickets" />
        <link rel="canonical" href="https://highlandeventshub.co.uk/sell-tickets" />
      </Head>

      {/* ─── HERO SECTION ────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-slate-800">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Launch Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold mb-6 shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>Native Ticketing Engine Now Live Across the Highlands</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
            Sell tickets directly to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
              Highland audiences.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Keep more of your revenue with lower booking fees, automated direct bank payouts via Stripe, and regional discovery built specifically for the Highlands.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none">
            <Link
              href="/create-event"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-full shadow-lg shadow-emerald-900/30 hover:shadow-emerald-700/40 transition-all text-base sm:text-lg transform hover:-translate-y-0.5"
            >
              <span>Create an Event & Start Selling</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#comparison"
              onClick={scrollToComparison}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 font-medium py-4 px-7 rounded-full transition-all text-base sm:text-lg backdrop-blur-sm"
            >
              <span>View fee comparison ↓</span>
            </a>
          </div>

          {/* Key Value Micro-Badges */}
          <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Banknote className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-slate-200">Lower platform fees</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-slate-200">Direct Stripe payouts</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-slate-200">In-browser QR scanner</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-slate-200">100% Highland reach</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS (3-STEP GRID) ──────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-950/60 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs sm:text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-2">
              Simple & Streamlined
            </h2>
            <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              How It Works
            </p>
            <p className="text-slate-400 mt-3 text-base sm:text-lg">
              Start selling tickets to local audiences in three straightforward steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 p-8 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-xl group">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                    <Calendar className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-800/80 px-2.5 py-1 rounded-full">
                    STEP 01
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  List your event in 90 seconds
                </h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  Add dates, venue, ticket tiers, and capacity through a straightforward form.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/60 text-xs font-medium text-emerald-400">
                ✓ No approval probation delays
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 p-8 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-xl group">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                    <CreditCard className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-800/80 px-2.5 py-1 rounded-full">
                    STEP 02
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Connect your bank account
                </h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  Complete a 2-minute setup via Stripe. Ticket revenues deposit directly into your own UK bank account. The Hub never holds your funds.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/60 text-xs font-medium text-emerald-400">
                ✓ Direct payouts to your bank
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 p-8 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-xl group">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform">
                    <QrCode className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-800/80 px-2.5 py-1 rounded-full">
                    STEP 03
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Check attendees in at the door
                </h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  Scan ticket QR codes in real time using your smartphone camera, or print a backup check-in list with attendee names and codes.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/60 text-xs font-medium text-emerald-400">
                ✓ No app download needed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PLATFORM COMPARISON TABLE ───────────────────────────── */}
      <section id="comparison" className="py-20 md:py-28 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs sm:text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-2">
              Transparent & Honest
            </h2>
            <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Platform Comparison
            </p>
            <p className="text-slate-400 mt-3 text-base sm:text-lg">
              Compare Highland Events Hub with legacy national ticketing platforms.
            </p>
          </div>

          {/* Comparison Table Container */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-wider">
                    <th className="py-5 px-6 font-semibold text-slate-400 w-1/4">Feature / Platform</th>
                    <th className="py-5 px-6 font-bold text-white bg-emerald-950/40 border-x border-emerald-500/30 w-1/4 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-300">Highland Events Hub</span>
                        <span className="bg-emerald-500 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-normal">
                          Best Value
                        </span>
                      </div>
                    </th>
                    <th className="py-5 px-6 font-semibold text-slate-400 w-1/6">Eventbrite</th>
                    <th className="py-5 px-6 font-semibold text-slate-400 w-1/6">Skiddle</th>
                    <th className="py-5 px-6 font-semibold text-slate-400 w-1/6">Ticketmaster</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {/* Row 1: Fee */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-bold text-slate-200">
                      Platform / Booking Fee
                    </td>
                    <td className="py-5 px-6 bg-emerald-950/20 border-x border-emerald-500/30 text-emerald-300 font-bold">
                      4.5%–5% + 30p per ticket
                      <span className="block text-xs font-normal text-emerald-400/80 mt-1">
                        (Choose to absorb or pass to buyer)
                      </span>
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      6.5%–9.9% + per-ticket fees (or monthly organizer subscriptions)
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      ~7%–10% + fixed per-ticket fees
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      15%–25%+ in combined service and processing fees
                    </td>
                  </tr>

                  {/* Row 2: Payout Schedule */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-bold text-slate-200">
                      Payout Schedule
                    </td>
                    <td className="py-5 px-6 bg-emerald-950/20 border-x border-emerald-500/30 text-emerald-300 font-bold">
                      Direct to your bank account via Stripe
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Often held until after the event concludes
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Scheduled payout cycles post-event
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Held until post-event reconciliation
                    </td>
                  </tr>

                  {/* Row 3: Discovery Focus */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-bold text-slate-200">
                      Discovery Focus
                    </td>
                    <td className="py-5 px-6 bg-emerald-950/20 border-x border-emerald-500/30 text-emerald-300 font-bold">
                      100% dedicated to the Scottish Highlands
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      National algorithm; local gigs buried under Glasgow/Edinburgh arena tours
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Geared towards national clubs and major cities
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Stadiums, arenas, and massive commercial tours
                    </td>
                  </tr>

                  {/* Row 4: Door Management */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-bold text-slate-200">
                      Door Management
                    </td>
                    <td className="py-5 px-6 bg-emerald-950/20 border-x border-emerald-500/30 text-emerald-300 font-bold">
                      Built-in smartphone camera scanner + printable check-in sheets
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Requires proprietary organizer app download
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Requires dedicated scanner app or hardware
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Complex enterprise scanner equipment
                    </td>
                  </tr>

                  {/* Row 5: Community & Free Events */}
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 font-bold text-slate-200">
                      Community & Free Events
                    </td>
                    <td className="py-5 px-6 bg-emerald-950/20 border-x border-emerald-500/30 text-emerald-300 font-bold">
                      100% free to list forever
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Tiered pricing or paid limits on free RSVPs
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Geared strictly to paid nightlife listings
                    </td>
                    <td className="py-5 px-6 text-slate-400">
                      Irrelevant for grassroots or community events
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ORGANISER FAQ ───────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-950/60 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs sm:text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-2">
              Got Questions?
            </h2>
            <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Organiser FAQ
            </p>
            <p className="text-slate-400 mt-3 text-base sm:text-lg">
              Everything you need to know about setting up tickets and getting paid.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'bg-slate-900 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 font-semibold text-base sm:text-lg text-white"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-emerald-400 transition-transform duration-200 flex-shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-slate-300 text-sm sm:text-base leading-relaxed border-t border-slate-800/60">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── BOTTOM LAUNCH CTA ───────────────────────────────────── */}
      <section className="relative py-20 md:py-28 px-4 text-center overflow-hidden border-t border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-emerald-950/50 to-slate-950" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs sm:text-sm font-semibold mb-6">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Launch Special: Guaranteed Regional Spotlight</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Ready to list your next event?
          </h2>

          <p className="text-slate-300 mb-10 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-normal">
            The first 5 events to set up native ticketing receive guaranteed featured homepage placement across the region.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/create-event"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 px-10 rounded-full shadow-xl shadow-emerald-900/40 hover:shadow-emerald-700/50 transition-all text-lg transform hover:-translate-y-0.5"
            >
              <span>List an Event Now</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
