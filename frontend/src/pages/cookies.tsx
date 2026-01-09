import Head from 'next/head';
import Link from 'next/link';

export default function CookiesPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <Head>
                <title>Cookie Policy | Highland Events Hub</title>
                <meta name="description" content="Cookie Policy for Highland Events Hub - How we use cookies" />
            </Head>
            <div className="max-w-3xl mx-auto px-4">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
                <p className="text-sm text-gray-500 mb-8"><strong>Last Updated:</strong> January 9, 2026</p>

                <div className="prose prose-gray max-w-none space-y-8">
                    {/* Section 1 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">1. What Are Cookies?</h2>
                        <p className="text-gray-600">
                            Cookies are small text files stored on your device when you visit a website. We use them to make Highland Events Hub work and to keep it secure.
                        </p>
                    </section>

                    {/* Section 2 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">2. The Cookies We Use</h2>
                        <p className="text-gray-600 mb-3">
                            We only use <strong>Strictly Necessary Cookies</strong>. These are essential for the website to function. You cannot switch them off in our systems.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>
                                <strong>Session Cookies:</strong> To remember your login state (if you are an admin) and ensure the website loads correctly.
                            </li>
                            <li>
                                <strong>Security Cookies:</strong> To protect the site from attacks (CSRF tokens).
                            </li>
                            <li>
                                <strong>Stripe (Payment Processing):</strong> When you interact with our payment pages, Stripe may place cookies to detect fraud and ensure secure transactions.
                            </li>
                        </ul>
                    </section>

                    {/* Section 3 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">3. What We Do NOT Use</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>
                                <strong>No Tracking Cookies:</strong> We do not currently use Google Analytics, Facebook Pixel, or other third-party tracking software.
                            </li>
                            <li>
                                <strong>No Advertising Cookies:</strong> We do not sell your browsing data to advertisers.
                            </li>
                        </ul>
                    </section>

                    {/* Section 4 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">4. How to Manage Cookies</h2>
                        <p className="text-gray-600">
                            You can set your browser to block or alert you about these cookies, but some parts of the site (like payment forms) may not work. To learn more about managing cookies, visit{' '}
                            <a
                                href="https://www.allaboutcookies.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:underline"
                            >
                                allaboutcookies.org
                            </a>.
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
