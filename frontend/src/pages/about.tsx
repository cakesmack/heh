import Head from 'next/head';
import Link from 'next/link';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-16">
            <Head>
                <title>About Us | Highland Events Hub</title>
            </Head>
            <div className="max-w-3xl mx-auto px-4 text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">About Us</h1>
                <p className="text-gray-600 text-lg mb-8">
                    Highland Events Hub is the definitive guide to culture, music, and adventure in the heart of Scotland. More about our story coming soon.
                </p>
                <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
                    &larr; Back to Home
                </Link>
            </div>
        </div>
    );
}
