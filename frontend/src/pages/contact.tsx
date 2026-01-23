import Head from 'next/head';
import Link from 'next/link';

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-16">
            <Head>
                <title>Contact Us | Highland Events Hub</title>
            </Head>
            <div className="max-w-3xl mx-auto px-4 text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">Contact Us</h1>
                <p className="text-gray-600 text-lg mb-8">
                    Need help or have questions? Reach out to us at:
                </p>
                <a
                    href="mailto:contact@highlandeventshub.co.uk"
                    className="inline-block px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-full shadow-lg transition-transform hover:scale-105"
                >
                    contact@highlandeventshub.co.uk
                </a>
                <div className="mt-8">
                    <Link href="/" className="text-gray-500 hover:text-gray-700 font-medium">
                        &larr; Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
