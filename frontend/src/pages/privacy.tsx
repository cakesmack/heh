import Head from 'next/head';
import Link from 'next/link';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <Head>
                <title>Privacy Policy | Highland Events Hub</title>
                <meta name="description" content="Privacy Policy for Highland Events Hub - GDPR compliant data handling practices" />
            </Head>
            <div className="max-w-3xl mx-auto px-4">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
                <p className="text-sm text-gray-500 mb-8"><strong>Last Updated:</strong> January 9, 2026</p>

                <div className="prose prose-gray max-w-none space-y-8">
                    {/* Section 1 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Who We Are</h2>
                        <p className="text-gray-600">
                            Highland Events Hub ("we", "us", or "our") is a trading name of Highland Events Hub, a Sole Trader based in Inverness, Scotland. We act as the "Data Controller" for your personal information.
                        </p>
                        <p className="text-gray-600 mt-2">
                            <strong>Contact:</strong>{' '}
                            <a href="mailto:contact@highlandeventshub.co.uk" className="text-emerald-600 hover:underline">
                                contact@highlandeventshub.co.uk
                            </a>
                        </p>
                    </section>

                    {/* Section 2 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Data We Collect</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>
                                <strong>Organizers:</strong> When you submit an event, we collect your name and email address to manage the listing.
                            </li>
                            <li>
                                <strong>Website Visitors:</strong> We may collect technical data (IP address, browser type) to ensure site security and performance.
                            </li>
                            <li>
                                <strong>Payments:</strong> We do NOT store your credit/debit card details. All payment data is processed securely by Stripe, our third-party payment processor.
                            </li>
                        </ul>
                    </section>

                    {/* Section 3 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Data</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>To publish and manage your event listings.</li>
                            <li>To communicate with you regarding your account or submissions.</li>
                            <li>To comply with legal obligations (e.g., fraud prevention).</li>
                        </ul>
                        <p className="text-gray-600 mt-3 font-medium">
                            We do not sell your data to third parties.
                        </p>
                    </section>

                    {/* Section 4 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Your Rights (GDPR)</h2>
                        <p className="text-gray-600 mb-2">Under UK data protection law, you have rights including:</p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>
                                <strong>Right to Access:</strong> You can ask for copies of your personal data.
                            </li>
                            <li>
                                <strong>Right to Erasure:</strong> You can ask us to delete your personal data ("Right to be forgotten").
                            </li>
                        </ul>
                        <p className="text-gray-600 mt-3">
                            To exercise these rights, email us at{' '}
                            <a href="mailto:contact@highlandeventshub.co.uk" className="text-emerald-600 hover:underline">
                                contact@highlandeventshub.co.uk
                            </a>
                        </p>
                    </section>

                    {/* Section 5 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">5. Third-Party Links</h2>
                        <p className="text-gray-600">
                            Our website contains links to third-party websites (e.g., ticket providers, venues). We are not responsible for the privacy policies or content of those websites.
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
