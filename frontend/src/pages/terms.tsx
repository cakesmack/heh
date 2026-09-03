import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  ShieldCheck,
  FileText,
  Ticket,
  Store,
  Sparkles,
  Scale,
  Gavel,
  Mail,
  ArrowRight,
  Info,
  AlertTriangle,
} from 'lucide-react';

interface TocSection {
  id: string;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const SECTIONS: TocSection[] = [
  { id: 'general', title: '1. General Website Terms', shortTitle: 'General Terms', icon: FileText },
  { id: 'content', title: '2. User Content & Submissions', shortTitle: 'User Content', icon: ShieldCheck },
  { id: 'ticketing', title: '3. Attendee Ticket Purchase Terms', shortTitle: 'Attendee Tickets', icon: Ticket, badge: 'Buyer' },
  { id: 'organiser', title: '4. Organiser Terms & Merchant Agreement', shortTitle: 'Organiser Agreement', icon: Store, badge: 'Seller' },
  { id: 'featured', title: '5. Featured Listings Advertising', shortTitle: 'Featured Listings', icon: Sparkles },
  { id: 'liability', title: '6. Limitation of Liability', shortTitle: 'Liability', icon: Scale },
  { id: 'governing-law', title: '7. Governing Law & Jurisdiction', shortTitle: 'Scots Law', icon: Gavel },
  { id: 'contact', title: '8. Contact Information', shortTitle: 'Contact', icon: Mail },
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState<string>('general');

  useEffect(() => {
    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: '-100px 0px -65% 0px',
      threshold: 0,
    });

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 py-8 sm:py-12">
      <Head>
        <title>Terms of Service | Highland Events Hub</title>
        <meta
          name="description"
          content="Terms of Service, Attendee Sales Conditions, and Event Organiser Merchant Agreement for Highland Events Hub under Scots law."
        />
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="border-b border-gray-200 pb-8 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100/80 text-emerald-800 rounded-full text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Legal & Platform Policies
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
            Terms of Service
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-500 mt-3">
            <span><strong>Last Updated:</strong> September 2026</span>
            <span>&bull;</span>
            <span>Governed by Scots Law</span>
          </div>
          <p className="text-sm sm:text-base text-gray-600 mt-4 max-w-4xl leading-relaxed">
            These Terms of Service govern your access to and use of Highland Events Hub, including our event discovery directory, user-generated listings, attendee ticket purchases, and organiser merchant ticketing services.
          </p>
        </div>

        {/* Mobile Horizontal Quick-Jump Bar */}
        <div className="lg:hidden sticky top-16 z-30 bg-white/95 backdrop-blur-md -mx-4 px-4 py-2.5 border-y border-gray-200 shadow-xs mb-8">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide py-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Jump to:</span>
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {section.shortTitle}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid: Desktop Sticky TOC Sidebar + Content */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-10 items-start">
          {/* Desktop Sticky Sidebar */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-24">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">
                Table of Contents
              </h2>
              <nav className="space-y-1">
                {SECTIONS.map((section) => {
                  const isActive = activeSection === section.id;
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition-all group cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-900 font-bold border-l-4 border-emerald-600 pl-2.5'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-gray-400 group-hover:text-gray-600'}`} />
                        <span className="truncate">{section.title}</span>
                      </div>
                      {section.badge && (
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                          isActive
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {section.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 pt-5 border-t border-gray-100 text-xs text-gray-500 space-y-2">
                <p>Need legal clarification?</p>
                <a
                  href="mailto:contact@highlandeventshub.co.uk"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  contact@highlandeventshub.co.uk
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </aside>

          {/* Legal Terms Content Column */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-12 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 sm:p-10">
            
            {/* Section 1: General Website Terms */}
            <section id="general" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  1. General Website Terms
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  <strong>1.1 Acceptance of Terms:</strong> By accessing, browsing, or using Highland Events Hub (the "Platform", "Service", or "Site"), you confirm that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these terms in full, you must immediately cease using the Platform.
                </p>
                <p>
                  <strong>1.2 Platform Intermediary Status:</strong> Highland Events Hub operates strictly as an online event discovery directory and software technology provider. Highland Events Hub is not an event organiser, promoter, producer, venue operator, or host. We do not control, manage, or supervise the events listed on the Site.
                </p>
                <p>
                  <strong>1.3 Service Availability:</strong> The Platform is provided on an "as is" and "as available" basis. Highland Events Hub makes no warranties or representations that the Service will be uninterrupted, timely, secure, or error-free. Maintenance, server migrations, or emergency updates may cause temporary interruptions.
                </p>
              </div>
            </section>

            {/* Section 2: User-Generated Content & Submissions */}
            <section id="content" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  2. User-Generated Content & Event Submissions
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  <strong>2.1 Submission Accuracy:</strong> Organisers and users submitting events are solely responsible for ensuring the accuracy, completeness, and legality of all submitted information, including event titles, descriptions, dates, times, age restrictions, ticket pricing, and venue locations.
                </p>
                <p>
                  <strong>2.2 Copyright & Intellectual Property Warranty:</strong> By uploading any images, graphics, audio, or text to the Platform, you warrant and represent that you own all copyright and intellectual property rights, or possess valid licenses and written permissions from the rights holders.
                </p>
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs sm:text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Third-Party IP Indemnification:</strong> You agree to fully indemnify, defend, and hold harmless Highland Events Hub and its operators against any and all claims, damages, liabilities, losses, costs, or legal expenses resulting from any alleged or actual infringement of third-party copyright or intellectual property rights.
                  </div>
                </div>
                <p>
                  <strong>2.3 Platform License:</strong> By posting or submitting content, you grant Highland Events Hub a non-exclusive, worldwide, royalty-free, perpetual license to host, display, index, reformat, distribute, and promote your event details across the Platform, search engines, and official social media channels.
                </p>
                <p>
                  <strong>2.4 Moderation & Listing Removal:</strong> Highland Events Hub reserves the right, at its sole discretion and without prior notice, to edit, refuse, quarantine, or delete any listing, or terminate any user account, that violates community guidelines, contains profanity, promotes unlawful activity, or exhibits deceptive practices.
                </p>
              </div>
            </section>

            {/* Section 3: Attendee Ticket Purchase Terms */}
            <section id="ticketing" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    3. Attendee Ticket Purchase Terms
                  </h2>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    Terms of Sale for Ticket Buyers
                  </span>
                </div>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  <strong>3.1 Direct Contract of Sale with the Organiser:</strong> When you purchase a ticket on Highland Events Hub, your contractual agreement for admission and event delivery is formed <strong>strictly and exclusively between you (the Buyer) and the designated Event Organiser (the Seller)</strong>. Highland Events Hub provides the software platform facilitating the transaction and is not a party to the contract of sale.
                </p>

                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-950 text-xs sm:text-sm flex items-start gap-3">
                  <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>3.2 All Sales Are Final:</strong> All ticket purchases made on Highland Events Hub are final and non-refundable. Change of personal circumstances, travel difficulties, adverse weather (unless the event is formally cancelled), illness, or change of mind do not entitle ticket holders to a refund, exchange, or credit.
                  </div>
                </div>

                <p>
                  <strong>3.3 Cancellations and Major Postponements:</strong> If an event is cancelled, abandoned, or significantly rescheduled by the Organiser, the ticket purchaser is entitled to a face-value refund directly from the Event Organiser in accordance with UK consumer protection law. The Organiser is responsible for issuing all face-value refunds directly to original payment methods.
                </p>

                <p>
                  <strong>3.4 Platform Booking & Processing Fees:</strong> Booking fees and payment processing charges represent software and payment processing services rendered at the point of purchase. Booking fees are non-refundable under all circumstances, except where mandatory consumer statutory law explicitly requires otherwise.
                </p>

                <p>
                  <strong>3.5 E-Tickets & Admission Conditions:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-gray-600 text-sm">
                  <li>Upon completed purchase, buyers receive a digital e-ticket containing a unique, verifiable QR code. Attendees must present the digital QR code on a mobile device or as a printed pass at the venue entrance.</li>
                  <li>Event Organisers and venue operators retain complete legal authority to enforce age limits, licensing regulations, security checks, and health and safety requirements.</li>
                  <li>The Organiser reserves the right to refuse admission or eject any attendee for unruly behaviour, intoxication, failure to produce valid age verification ID, or breach of venue policies without refund or compensation.</li>
                </ul>
              </div>
            </section>

            {/* Section 4: Event Organiser Terms & Merchant Agreement */}
            <section id="organiser" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    4. Event Organiser Terms & Merchant Agreement
                  </h2>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    Merchant Agreement for Event Organisers & Sellers
                  </span>
                </div>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  <strong>4.1 Stripe Connect Integration & Payouts:</strong> Payment processing and direct payout services for ticket sellers on Highland Events Hub are provided by <strong>Stripe Payments Europe, Ltd.</strong> ("Stripe"). To sell tickets, Organisers must connect a verified UK bank account and agree to the <a href="https://stripe.com/gb/connect-account/legal" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-semibold">Stripe Connected Account Agreement</a>. Highland Events Hub does not hold, escrow, or intermediate seller funds; net ticket proceeds route automatically to the Organiser's Stripe account in accordance with Stripe's rolling payout schedule.
                </p>

                <p>
                  <strong>4.2 Platform Service Fees:</strong> Highland Events Hub applies a platform service fee (typically 4.5%–5% + 30p per ticket sold) on paid ticket transactions. Organisers may choose in the Event Wizard to absorb this fee or pass it on to the ticket buyer at checkout.
                </p>

                <p>
                  <strong>4.3 Organiser Legal Obligations:</strong> By creating a ticketed event, the Organiser agrees and covenants to:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-gray-600 text-sm">
                  <li>Deliver the event in full accordance with the advertised date, time, description, venue, and ticket tier specifications.</li>
                  <li>Comply strictly with the <em>Consumer Rights Act 2015</em>, the <em>Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013</em>, and all applicable Scottish licensing, safety, and venue laws.</li>
                  <li>Promptly notify all ticket purchasers and process full face-value refunds if the event is cancelled, abandoned, or materially altered.</li>
                </ul>

                <div className="p-4 bg-red-50/80 border border-red-200 rounded-xl text-red-950 text-xs sm:text-sm space-y-2">
                  <div className="flex items-center gap-2 font-bold text-red-900">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    4.4 Chargeback & Dispute Liability (100% Organiser Responsibility)
                  </div>
                  <p className="leading-relaxed">
                    The Organiser is <strong>100% financially liable</strong> for all customer disputes, card chargebacks, reversals, and associated Stripe dispute administration fees (currently &pound;15.00 per dispute). The Organiser explicitly agrees to indemnify and reimburse Highland Events Hub against any chargebacks, financial recoveries, claims, or legal expenses incurred as a result of the Organiser's events, unfulfilled orders, or failure to issue mandatory consumer refunds.
                  </p>
                </div>

                <p>
                  <strong>4.5 Account Enforcement & Sales Freezes:</strong> Highland Events Hub reserves the right to freeze ticket sales, withhold platform features, or terminate organiser accounts in the event of suspected fraud, excessive dispute rates, or failure to deliver scheduled events.
                </p>
              </div>
            </section>

            {/* Section 5: Featured Listings Advertising Terms */}
            <section id="featured" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  5. Featured Listings Advertising Terms
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  <strong>5.1 Nature of Digital Advertising:</strong> Featured Listings are digital promotional advertising services. By purchasing a Featured Listing promotion, you acknowledge that the digital advertising service is deemed consumed immediately upon publication of your event in the Featured section.
                </p>
                <p>
                  <strong>5.2 Administrative Review & Automatic Refunds:</strong> All paid featured submissions undergo administrative review to ensure compliance with community standards. If a submission is rejected prior to publication, a 100% full refund is automatically issued to the original payment method within 5–10 business days.
                </p>
                <p>
                  <strong>5.3 No Post-Publication Refunds:</strong> Once an event has been approved and published to the platform, advertising fees are strictly non-refundable under any circumstances, including subsequent cancellation of the event by the advertiser or early removal from the platform.
                </p>
              </div>
            </section>

            {/* Section 6: Limitation of Liability */}
            <section id="liability" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  6. Limitation of Liability & Cap
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  <strong>6.1 Exclusion of Consequential Damages:</strong> To the maximum extent permitted by UK law, Highland Events Hub, its directors, employees, and operators shall not be liable for any indirect, incidental, special, punitive, or consequential damages, including loss of profits, loss of data, loss of business opportunity, or reputational harm arising from your use of the Platform.
                </p>
                <p>
                  <strong>6.2 Financial Liability Cap:</strong> To the extent permitted by law, the total cumulative liability of Highland Events Hub for any claim or dispute arising out of or related to the Platform, whether in contract, delict (including negligence), or otherwise, shall not exceed the total fees paid by you to Highland Events Hub in the twelve (12) months preceding the claim, or &pound;100.00, whichever is greater.
                </p>
              </div>
            </section>

            {/* Section 7: Governing Law & Jurisdiction */}
            <section id="governing-law" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Gavel className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  7. Governing Law & Jurisdiction
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  <strong>7.1 Scots Law:</strong> These Terms of Service, their subject matter, and their formation (and any non-contractual disputes or claims) shall be governed by and construed in accordance with the <strong>laws of Scotland</strong>.
                </p>
                <p>
                  <strong>7.2 Exclusive Scottish Jurisdiction:</strong> You and Highland Events Hub irrevocably agree that the courts of Scotland shall have exclusive jurisdiction to settle any dispute, controversy, or claim arising out of or in connection with these Terms or the Platform.
                </p>
              </div>
            </section>

            {/* Section 8: Contact Information */}
            <section id="contact" className="scroll-mt-28">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  8. Contact Information
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  For any legal inquiries, questions regarding these Terms of Service, or support with platform ticketing, please contact our team:
                </p>
                <div className="p-5 bg-stone-50 border border-gray-200 rounded-xl space-y-2">
                  <div className="text-sm font-semibold text-gray-900">Highland Events Hub</div>
                  <div className="text-sm text-gray-600">
                    Email:{' '}
                    <a href="mailto:contact@highlandeventshub.co.uk" className="text-emerald-700 hover:text-emerald-800 underline font-medium">
                      contact@highlandeventshub.co.uk
                    </a>
                  </div>
                  <div className="text-xs text-gray-500 pt-1">
                    We aim to respond to all legitimate inquiries within 1–2 business days.
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom Back Link */}
            <div className="pt-8 border-t border-gray-100 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800 font-semibold text-sm transition-colors"
              >
                &larr; Back to Highland Events Hub
              </Link>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                Back to top &uarr;
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
