import Head from 'next/head';
import Link from 'next/link';
import { Card } from '@/components/common/Card';
import { Disclosure } from '@/components/common/Disclosure';
import { contactEmail, contactMailto, listingMailto, contactHelpGroups } from '@/components/help/contactHelpContent';

const linkClass = 'inline-flex min-h-11 items-center rounded text-sm font-semibold text-moss-green underline underline-offset-4 hover:text-highland-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss-green focus-visible:ring-offset-2';
const emailClass = 'inline-flex min-h-12 max-w-full items-center justify-center break-all rounded-full bg-highland-green px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-moss-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss-green focus-visible:ring-offset-2 sm:text-base';

const quickActions = [
  { title: 'Add an event', description: 'Add and manage your own events completely free.', href: '/create-event' },
  { title: 'Find organisations', description: 'View organisation and group pages on Highland Events Hub.', href: '/groups' },
  { title: 'Find venues', description: 'Browse venue pages and find contact information for venues.', href: '/venues' },
];

export default function ContactPage() {
  return <div className="min-h-screen bg-gray-50 py-10 sm:py-14">
    <Head>
      <title>Contact &amp; Help | Highland Events Hub</title>
      <meta name="description" content="Get help with event listings, bookings, organisations and venues on Highland Events Hub, or contact the independent site owner." />
    </Head>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-highland-green sm:text-4xl">Contact &amp; Help</h1>
        <p className="text-base leading-7 text-gray-600 sm:text-lg">Need help with Highland Events Hub? You may find the answer below. If you still need to get in touch, you can contact me directly.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="mb-3 text-xl font-bold text-highland-green">Contact Highland Events Hub</h2>
          <p className="mb-5 leading-7 text-gray-600">Highland Events Hub is run independently alongside my full-time job, so I may not always be able to reply straight away. Please allow a few days for a response.</p>
          <a href={contactMailto} className={emailClass}>{contactEmail}</a>
          <aside className="mt-6 rounded-xl border-l-4 border-golden-heather bg-amber-50/70 p-4 sm:p-5" aria-labelledby="event-enquiry-heading">
            <h3 id="event-enquiry-heading" className="mb-2 font-bold text-highland-green">Question about a specific event?</h3>
            <p className="text-sm leading-7 text-stone-dark"><strong>Highland Events Hub does not organise the events listed on the site.</strong> For questions about cancellations, tickets, refunds, accessibility, paying on the door, changes to dates or times, or anything else specific to an event, please contact the event organiser or venue directly.</p>
            <p className="mt-3 text-sm leading-6 text-gray-600">Where organiser or venue information is available, you can find it on the event listing.</p>
          </aside>
        </Card>

        <Card className="min-w-0">
          <h2 className="mb-4 text-xl font-bold text-highland-green">Quick help</h2>
          <nav aria-label="Quick help" className="space-y-3">
            {quickActions.map(action => <Link key={action.href} href={action.href} className="block min-h-12 rounded-xl bg-gray-50 p-4 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss-green focus-visible:ring-offset-2">
              <span className="block font-semibold text-highland-green">{action.title}<span aria-hidden="true"> →</span></span>
              <span className="mt-1 block text-sm leading-6 text-gray-600">{action.description}</span>
            </Link>)}
          </nav>
          <div className="mt-5 rounded-xl bg-emerald-50/60 p-4">
            <h3 className="font-bold text-highland-green">Need me to add your event?</h3>
            <p className="mt-2 text-sm leading-7 text-gray-600">Adding your own event is free. If you are short on time, I can create the listing for you for £10 per event.</p>
            <a href={listingMailto} className={linkClass}>Ask about a done-for-you listing</a>
          </div>
        </Card>
      </div>

      <section className="mt-12" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-highland-green">Frequently asked questions</h2>
        <p className="mt-3 max-w-3xl leading-7 text-gray-600">Choose a section below to find answers to common questions about events, listings, ticketing and Highland Events Hub.</p>
        <div className="mt-8 space-y-9">
          {contactHelpGroups.map(group => <section key={group.id} aria-labelledby={`${group.id}-heading`}>
            <h3 id={`${group.id}-heading`} className="mb-2 text-lg font-bold text-highland-green">{group.title}</h3>
            <div className="rounded-xl bg-white px-4 sm:px-6">
              {group.questions.map(faq => <Disclosure key={faq.question} title={faq.question}>
                {faq.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {faq.links && <div className="flex flex-wrap gap-x-5 gap-y-1">{faq.links.map(link => link.href.startsWith('mailto:')
                  ? <a key={link.href} href={link.href} className={linkClass}>{link.label}</a>
                  : <Link key={link.href} href={link.href} className={linkClass}>{link.label}</Link>)}</div>}
              </Disclosure>)}
            </div>
          </section>)}
        </div>
      </section>

      <section aria-labelledby="still-need-help" className="mt-12 rounded-2xl bg-emerald-50/70 p-5 sm:p-8">
        <h2 id="still-need-help" className="text-2xl font-bold text-highland-green">Still need help?</h2>
        <p className="my-4 leading-7 text-gray-600">If your question is not covered above, you can contact me at:</p>
        <a href={contactMailto} className={emailClass}>{contactEmail}</a>
        <p className="mt-4 text-sm leading-7 text-gray-600">For questions about a specific event, please contact the event organiser or venue wherever possible.</p>
      </section>
      <Link href="/" className={`${linkClass} mt-6`}>← Back to Home</Link>
    </div>
  </div>;
}
