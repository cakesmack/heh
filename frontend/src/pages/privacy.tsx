import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  ShieldCheck,
  Database,
  Scale,
  Share2,
  Clock,
  Cookie,
  Mail,
  Lock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface TocSection {
  id: string;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const SECTIONS: TocSection[] = [
  { id: 'data-collected', title: '1. Data We Collect', shortTitle: 'Data Collected', icon: Database },
  { id: 'lawful-basis', title: '2. Lawful Basis for Processing', shortTitle: 'Lawful Basis', icon: Scale, badge: 'UK GDPR' },
  { id: 'data-sharing', title: '3. How Data is Shared', shortTitle: 'Data Sharing', icon: Share2 },
  { id: 'retention', title: '4. Data Retention Schedule', shortTitle: 'Retention', icon: Clock, badge: 'HMRC' },
  { id: 'cookies', title: '5. Cookies & Local Storage', shortTitle: 'Cookies & Storage', icon: Cookie },
  { id: 'your-rights', title: '6. Your Rights Under UK GDPR', shortTitle: 'Your Rights', icon: ShieldCheck, badge: 'Rights' },
  { id: 'contact', title: '7. Contact & Data Protection', shortTitle: 'Contact Details', icon: Mail },
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState<string>('data-collected');

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
        <title>Privacy Policy | Highland Events Hub</title>
        <meta
          name="description"
          content="Privacy Policy and UK GDPR data protection compliance for Highland Events Hub, covering native ticketing, attendee data, and Stripe Connect processing."
        />
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="border-b border-gray-200 pb-8 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100/80 text-emerald-800 rounded-full text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Data Protection & Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
            Privacy Policy
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-500 mt-3">
            <span><strong>Last Updated:</strong> September 2026</span>
            <span>&bull;</span>
            <span>UK GDPR & Data Protection Act 2018</span>
          </div>
          <p className="text-sm sm:text-base text-gray-600 mt-4 max-w-4xl leading-relaxed">
            Highland Events Hub operates as an independent <strong>Data Controller</strong> for personal data collected through this platform. This Privacy Policy details how we collect, process, share, and protect your personal information when using our event discovery directory, native ticketing services, and organiser merchant features.
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
                Privacy Navigation
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
                <p>Data Protection Inquiries:</p>
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

          {/* Policy Content Column */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-12 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 sm:p-10">
            
            {/* Section 1: Data We Collect */}
            <section id="data-collected" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  1. Data We Collect
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  Highland Events Hub collects personal data to deliver event discovery, ticketing checkout, and organiser management services:
                </p>

                <div className="grid sm:grid-cols-2 gap-4 my-4">
                  <div className="p-4 bg-stone-50 border border-gray-200 rounded-xl space-y-2">
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      Event Organisers & Sellers
                    </h3>
                    <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                      <li>Full name and account credentials</li>
                      <li>Business or primary contact email address</li>
                      <li>Organisation and venue affiliation names</li>
                      <li>Stripe Connected Account identifier tokens</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-stone-50 border border-gray-200 rounded-xl space-y-2">
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      Ticket Buyers & Attendees
                    </h3>
                    <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                      <li>Full name and contact email address</li>
                      <li>Billing postcode and transaction history</li>
                      <li>Ticket tier selections and order references</li>
                      <li>Door check-in validation timestamps</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-950 text-xs sm:text-sm flex items-start gap-3">
                  <Lock className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Payment Card Security Notice:</strong> Full credit and debit card numbers, expiry dates, and CVVs are processed directly and securely by Stripe Payments Europe, Ltd. via client-side encrypted tokenization. Payment card details are <strong>never received, stored, or accessible</strong> on Highland Events Hub servers.
                  </div>
                </div>

                <p>
                  <strong>Website Visitors & Technical Data:</strong> When you browse Highland Events Hub, our servers automatically log standard technical telemetry, including your IP address, browser user-agent, device type, operating system, referring URL, and interface state preferences stored in local storage.
                </p>
              </div>
            </section>

            {/* Section 2: Lawful Basis for Processing */}
            <section id="lawful-basis" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    2. Lawful Basis for Processing
                  </h2>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    UK GDPR Article 6 Legal Framework
                  </span>
                </div>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  Under Article 6 of the UK GDPR, Highland Events Hub relies upon the following lawful bases to collect and process personal data:
                </p>

                <div className="space-y-3">
                  <div className="p-4 bg-stone-50 border border-gray-200 rounded-xl">
                    <div className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      1. Performance of a Contract (Article 6(1)(b))
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      Processing is necessary to perform our contractual obligations to you, including creating user accounts, publishing event listings, issuing verified digital QR e-tickets to ticket buyers, managing admission scanner validation, and routing merchant ticketing revenues to organisers.
                    </p>
                  </div>

                  <div className="p-4 bg-stone-50 border border-gray-200 rounded-xl">
                    <div className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      2. Compliance with Legal Obligations (Article 6(1)(c))
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      Processing is necessary to comply with UK statutory regulations, including maintaining financial transaction ledgers, invoicing records, and tax accounting data mandated by HM Revenue & Customs (HMRC).
                    </p>
                  </div>

                  <div className="p-4 bg-stone-50 border border-gray-200 rounded-xl">
                    <div className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      3. Legitimate Interests (Article 6(1)(f))
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      Processing is necessary for our legitimate commercial interests, such as maintaining platform security, preventing fraudulent transactions or ticket scalping, diagnosing server errors, and verifying door check-in validity.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: How Data is Shared */}
            <section id="data-sharing" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  3. How Data is Shared
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  Highland Events Hub shares personal data strictly as required to operate ticketing and event services:
                </p>

                <p>
                  <strong>3.1 With Event Organisers:</strong> When you purchase a ticket on Highland Events Hub, we share the attendee's full name, email address, purchased ticket tier, and unique check-in QR code directly with the designated Event Organiser. This data transfer is strictly limited to event door admission, attendee headcount management, and urgent event notification (e.g. cancellation or weather advisories). <em>Event Organisers act as independent data controllers for their subsequent use of attendee records.</em>
                </p>

                <p>
                  <strong>3.2 With Stripe Payments Europe, Ltd.:</strong> Payment processing, direct bank payouts, and anti-money laundering (AML) compliance checks are conducted via Stripe. Stripe acts as an independent regulated data controller regarding the financial transactions and identity verification it carries out.
                </p>

                <div className="p-4 bg-stone-100 border border-stone-300 rounded-xl text-gray-900 text-xs sm:text-sm">
                  <strong>Zero Commercial Selling:</strong> Highland Events Hub does <strong>never</strong> sell, rent, lease, or trade your personal data, email address, or browsing history to third-party advertisers, marketing agencies, or data brokers.
                </div>
              </div>
            </section>

            {/* Section 4: Data Retention */}
            <section id="retention" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    4. Data Retention Schedule
                  </h2>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    HMRC Statutory Retention
                  </span>
                </div>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  We retain personal data only for as long as necessary to fulfill the purposes for which it was gathered or to satisfy statutory UK compliance obligations:
                </p>

                <ul className="list-disc list-inside space-y-2 pl-2 text-gray-600 text-sm">
                  <li>
                    <strong>Transaction & Accounting Records:</strong> Financial records, invoice line items, and ticket order metadata are retained for <strong>six (6) full financial years</strong> following the end of the tax year in which the transaction occurred, in compliance with UK tax law and HMRC requirements.
                  </li>
                  <li>
                    <strong>User Account Data:</strong> Stored for the duration of an active user account. Upon receiving a verified account erasure request, account credentials and profile entries are permanently removed (except where statutory retention supersedes erasure).
                  </li>
                  <li>
                    <strong>Technical & Server Logs:</strong> Operational access logs and rate-limiting records are cleared or anonymized on a rolling <strong>90-day cycle</strong>.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 5: Cookies & Local Storage */}
            <section id="cookies" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Cookie className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  5. Cookies & Local Storage
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  Highland Events Hub is engineered with a privacy-first architecture:
                </p>
                <ul className="list-disc list-inside space-y-2 pl-2 text-gray-600 text-sm">
                  <li>
                    <strong>No Non-Essential Tracking Cookies:</strong> We do not deploy third-party advertising cookies, cross-site trackers, or invasive analytics beacons.
                  </li>
                  <li>
                    <strong>Functional Local Storage & Essential Cookies:</strong> We utilize browser <code>localStorage</code> strictly for functional platform state, including:
                    <ul className="list-circle list-inside pl-6 mt-1 space-y-1 text-gray-500 text-xs">
                      <li><code>he_hub_ticketing_banner_dismissed</code>: Remembers when you have dismissed the top announcement banner.</li>
                      <li>Authentication session tokens: Secures user login sessions across page navigations.</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 6: Your Rights Under UK GDPR */}
            <section id="your-rights" className="scroll-mt-28 border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    6. Your Rights Under UK GDPR
                  </h2>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    Data Subject Statutory Rights
                  </span>
                </div>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  Under the UK GDPR and the Data Protection Act 2018, you hold statutory rights regarding your personal data:
                </p>

                <div className="grid sm:grid-cols-2 gap-3 my-2">
                  <div className="p-3.5 bg-stone-50 border border-gray-200 rounded-xl">
                    <strong className="text-gray-900 text-xs block mb-1">Right to Access</strong>
                    <span className="text-xs text-gray-600">Request confirmation and copies of personal data held about you.</span>
                  </div>
                  <div className="p-3.5 bg-stone-50 border border-gray-200 rounded-xl">
                    <strong className="text-gray-900 text-xs block mb-1">Right to Rectification</strong>
                    <span className="text-xs text-gray-600">Request correction of inaccurate or incomplete personal records.</span>
                  </div>
                  <div className="p-3.5 bg-stone-50 border border-gray-200 rounded-xl">
                    <strong className="text-gray-900 text-xs block mb-1">Right to Erasure</strong>
                    <span className="text-xs text-gray-600">Request deletion of personal data (subject to HMRC statutory tax retention).</span>
                  </div>
                  <div className="p-3.5 bg-stone-50 border border-gray-200 rounded-xl">
                    <strong className="text-gray-900 text-xs block mb-1">Right to Restrict / Object</strong>
                    <span className="text-xs text-gray-600">Object to processing conducted under legitimate interests grounds.</span>
                  </div>
                </div>

                <p>
                  To exercise any of your data protection rights, please submit your request to <a href="mailto:contact@highlandeventshub.co.uk" className="text-emerald-700 hover:text-emerald-800 underline font-semibold">contact@highlandeventshub.co.uk</a>. We respond to all verified requests within one calendar month.
                </p>

                <div className="p-4 bg-stone-50 border border-gray-200 rounded-xl text-xs text-gray-600 space-y-1">
                  <strong>Right to Complain to the Regulator:</strong> You have the right to lodge a complaint with the UK supervisory authority, the <strong>Information Commissioner's Office (ICO)</strong>, if you believe your data has been handled unlawfully. Visit <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-medium">ico.org.uk</a> or call 0303 123 1113.
                </div>
              </div>
            </section>

            {/* Section 7: Contact Details */}
            <section id="contact" className="scroll-mt-28">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  7. Contact & Data Protection
                </h2>
              </div>

              <div className="prose prose-gray max-w-none space-y-4 text-sm sm:text-base text-gray-700 leading-relaxed">
                <p>
                  For any privacy inquiries, data subject access requests, or information regarding our data protection compliance, please reach out to our team:
                </p>
                <div className="p-5 bg-stone-50 border border-gray-200 rounded-xl space-y-2">
                  <div className="text-sm font-semibold text-gray-900">Highland Events Hub — Data Controller</div>
                  <div className="text-sm text-gray-600">
                    Location: Inverness, Scottish Highlands
                  </div>
                  <div className="text-sm text-gray-600">
                    Email:{' '}
                    <a href="mailto:contact@highlandeventshub.co.uk" className="text-emerald-700 hover:text-emerald-800 underline font-medium">
                      contact@highlandeventshub.co.uk
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom Navigation Link */}
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
