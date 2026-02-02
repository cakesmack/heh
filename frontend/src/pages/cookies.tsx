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
                        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Analytics & Third-Party Cookies</h2>
                        <p className="text-gray-600 mb-3">
                            We use Google Analytics to help us understand how our website is being used. This allows us to see how many people are visiting, which pages are most popular, and where our traffic is coming from. This information helps us improve the site and ensure it works well for everyone.
                        </p>
                        <p className="text-gray-600 mb-3">
                            Google Analytics uses cookies to collect this data. These cookies store information such as:
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2 mb-3">
                            <li>The time of your visit.</li>
                            <li>Whether you have visited the site before.</li>
                            <li>Which site referred you to the web page.</li>
                        </ul>
                        <p className="text-gray-600 mb-3">
                            <strong>Your Privacy:</strong> The data collected is anonymized. We do not use Google Analytics to collect any Personally Identifiable Information (PII) such as your name, email address, or phone number. We cannot identify you personally from this data.
                        </p>
                        <p className="text-gray-600">
                            <strong>Opting Out:</strong> If you prefer not to share this data, you can disable cookies in your browser settings. Google also offers a browser add-on to opt out of Google Analytics tracking across all websites, which you can find{' '}
                            <a
                                href="https://tools.google.com/dlpage/gaoptout"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:underline"
                            >
                                here
                            </a>.
                        </p>
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
