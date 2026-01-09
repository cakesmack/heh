import Head from 'next/head';
import Link from 'next/link';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <Head>
                <title>Terms & Conditions | Highland Events Hub</title>
                <meta name="description" content="Terms of Service and Refund Policy for Highland Events Hub" />
            </Head>
            <div className="max-w-3xl mx-auto px-4">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
                <p className="text-sm text-gray-500 mb-8"><strong>Last Updated:</strong> January 9, 2026</p>

                <div className="prose prose-gray max-w-none space-y-8">
                    {/* Section 1: Acceptance */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
                        <p className="text-gray-600">
                            By accessing Highland Events Hub, you agree to be bound by these Terms. If you do not agree, please do not use our services.
                        </p>
                    </section>

                    {/* Section 2: User-Generated Content */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">2. User-Generated Content</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>
                                <strong>Accuracy:</strong> You are solely responsible for the accuracy of the events you post. We are not responsible for cancelled events, incorrect times, or venue changes.
                            </li>
                            <li>
                                <strong>Copyright:</strong> You warrant that you own or have the rights to use any images or text you upload. <strong>You agree to indemnify Highland Events Hub</strong> against all claims, damages, or legal fees arising from content you upload (e.g., if you upload a copyrighted image without permission).
                            </li>
                            <li>
                                <strong>License:</strong> By posting content, you grant us a non-exclusive, royalty-free, worldwide license to display, modify, and distribute that content on our platform and social media channels.
                            </li>
                        </ul>
                    </section>

                    {/* Section 3: Liability Limitation */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Liability Limitation</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>
                                <strong>Service:</strong> The platform is provided "as is". We do not guarantee the site will be uninterrupted or error-free.
                            </li>
                            <li>
                                <strong>Liability:</strong> To the maximum extent permitted by UK law, Highland Events Hub shall not be liable for any indirect, incidental, or consequential damages (including loss of data or revenue) arising from your use of the service.
                            </li>
                            <li>
                                <strong>Cap:</strong> Our total liability to you for any claim shall not exceed the amount you have paid us in the last 12 months (or £100 if no payments were made).
                            </li>
                        </ul>
                    </section>

                    {/* Section 4: Content Moderation */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Content Moderation</h2>
                        <p className="text-gray-600">
                            We reserve the right to remove any event or user account at our sole discretion, without notice or liability, if we believe it violates our policies (e.g., scams, hate speech, illegal content).
                        </p>
                    </section>

                    {/* Section 5: Governing Law */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">5. Governing Law</h2>
                        <p className="text-gray-600">
                            These terms are governed by the laws of Scotland. Any disputes shall be subject to the exclusive jurisdiction of the Scottish courts.
                        </p>
                    </section>
                </div>

                {/* Refund & Cancellation Policy */}
                <div className="mt-12 pt-8 border-t border-gray-200">
                    <section id="refund-policy">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Refund & Cancellation Policy</h2>
                        <p className="text-sm text-gray-500 mb-6">For Featured Listings (Digital Advertising Services)</p>

                        <div className="prose prose-gray max-w-none space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">1. Nature of Services</h3>
                                <p className="text-gray-600">
                                    Highland Events Hub provides digital advertising services ("Featured Listings"). By purchasing a Featured Listing, you acknowledge that this is a digital service deemed "consumed" immediately upon the publication of your event to our platform.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">2. Delivery Policy</h3>
                                <ul className="list-disc list-inside text-gray-600 space-y-1">
                                    <li><strong>Submission Review:</strong> All paid submissions are subject to a manual review process to ensure they meet our community guidelines.</li>
                                    <li><strong>Timeframe:</strong> We aim to review and approve/reject submissions within 24 hours of payment.</li>
                                    <li><strong>Publication:</strong> Upon approval, your event will immediately appear in the "Featured" section of the platform.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">3. Refunds & Rejections</h3>
                                <ul className="list-disc list-inside text-gray-600 space-y-2">
                                    <li>
                                        <strong>If We Reject Your Event:</strong> If your submission violates our guidelines or is rejected by our administration for any reason <em>before</em> publication, a full refund will be automatically issued to your original payment method. Please allow 5-10 business days for the funds to settle.
                                    </li>
                                    <li>
                                        <strong>If You Cancel Before Approval:</strong> You may cancel your submission for a full refund at any time <em>before</em> the event has been approved and published. Contact us immediately at <a href="mailto:contact@highlandeventshub.co.uk" className="text-emerald-600 hover:underline">contact@highlandeventshub.co.uk</a> to request this.
                                    </li>
                                    <li>
                                        <strong>After Publication (No Refunds):</strong> Once your event has been approved and published to the site, the service is considered fully delivered. No refunds will be issued for Featured Listings after publication, even if you subsequently choose to remove the event or if the event itself is cancelled.
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">4. Event Cancellations</h3>
                                <p className="text-gray-600">
                                    You are responsible for the accuracy of your event details. If your event is cancelled, rescheduled, or modified, you are not entitled to a refund of the Featured Listing fee. The fee covers the advertising space and administrative time, not the occurrence of the event itself.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">5. Disputes</h3>
                                <p className="text-gray-600">
                                    By purchasing a Featured Listing, you agree to this policy and waive any right to subject these charges to a dispute or "chargeback" with your card issuer for reasons covered by this policy (e.g., event cancellation or dissatisfaction with view counts).
                                </p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Contact */}
                <section className="mt-12 pt-8 border-t border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Contact Us</h2>
                    <p className="text-gray-600">
                        If you have any questions about these terms, please contact us at{' '}
                        <a href="mailto:contact@highlandeventshub.co.uk" className="text-emerald-600 hover:underline">
                            contact@highlandeventshub.co.uk
                        </a>
                    </p>
                </section>

                <div className="pt-8 mt-8 border-t border-gray-200">
                    <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
                        &larr; Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
