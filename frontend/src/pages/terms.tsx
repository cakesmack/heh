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
                <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms & Conditions</h1>

                {/* Refund & Cancellation Policy */}
                <section id="refund-policy" className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Refund & Cancellation Policy</h2>
                    <p className="text-sm text-gray-500 mb-6"><strong>Last Updated:</strong> January 2026</p>

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

                {/* General Terms */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">General Terms of Use</h2>
                    <div className="prose prose-gray max-w-none space-y-4 text-gray-600">
                        <p>
                            By accessing and using Highland Events Hub, you accept and agree to be bound by the terms and provision of this agreement.
                        </p>
                        <p>
                            We reserve the right to modify, suspend, or discontinue any aspect of the service at any time without notice.
                        </p>
                        <p>
                            Users are responsible for maintaining accurate information in their event listings and profile details.
                        </p>
                    </div>
                </section>

                {/* Contact */}
                <section className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Us</h2>
                    <p className="text-gray-600">
                        If you have any questions about these terms, please contact us at{' '}
                        <a href="mailto:contact@highlandeventshub.co.uk" className="text-emerald-600 hover:underline">
                            contact@highlandeventshub.co.uk
                        </a>
                    </p>
                </section>

                <div className="pt-6 border-t border-gray-200">
                    <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
                        &larr; Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
