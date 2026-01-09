import Head from 'next/head';
import Link from 'next/link';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <Head>
                <title>About Us | Highland Events Hub</title>
                <meta name="description" content="Highland Events Hub - The definitive guide to events in the Scottish Highlands, built by a local developer in Inverness." />
            </Head>
            <div className="max-w-3xl mx-auto px-4">
                <h1 className="text-4xl font-bold text-gray-900 mb-8">About Highland Events Hub</h1>

                <div className="prose prose-gray max-w-none space-y-8">
                    {/* The Mission */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">The Mission</h2>
                        <p className="text-gray-600 text-lg">
                            Highland Events Hub exists for one simple reason: <strong>It shouldn't be this hard to find out what's on in the Highlands.</strong>
                        </p>
                        <p className="text-gray-600 mt-3">
                            We believe that whether it's a metal gig at a dive bar in Inverness, a craft market in Ross-shire, or a theatre show in Nairn, it deserves to be seen.
                        </p>
                    </section>

                    {/* The Story */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">The Story</h2>
                        <p className="text-gray-600">
                            This platform was built by a local developer based in Inverness. Frustrated by having to check five different Facebook groups, three venue websites, and a noticeboard just to plan a weekend, I decided to build the solution I wanted to use.
                        </p>
                    </section>

                    {/* How It Works */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">How It Works</h2>
                        <ul className="space-y-3 text-gray-600">
                            <li className="flex items-start gap-3">
                                <span className="text-emerald-600 font-bold">For Locals:</span>
                                <span>A free, clean, ad-free map and list of events. No paywalls, no clutter.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-emerald-600 font-bold">For Organizers:</span>
                                <span>Free listings. We don't charge you to be on the map.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-emerald-600 font-bold">The Business Model:</span>
                                <span>We are a transparent, independent business. We generate revenue by selling "Featured Spots" to organizers who want extra visibility. This keeps the core service free for everyone else.</span>
                            </li>
                        </ul>
                    </section>

                    {/* Get In Touch */}
                    <section className="bg-emerald-50 -mx-4 px-4 py-6 rounded-lg border border-emerald-100">
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">Get In Touch</h2>
                        <p className="text-gray-600 mb-3">
                            Have a suggestion? Found a bug? Want to partner?
                        </p>
                        <p className="text-gray-900 font-medium">
                            Email us at:{' '}
                            <a
                                href="mailto:contact@highlandeventshub.co.uk"
                                className="text-emerald-600 hover:underline"
                            >
                                contact@highlandeventshub.co.uk
                            </a>
                        </p>
                    </section>
                </div>

                <div className="pt-8 mt-8 border-t border-gray-200">
                    <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
                        &larr; Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
