import Head from 'next/head';
import Link from 'next/link';

export default function CookiesPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-16">
            <Head>
                <title>Cookie Policy | Highland Events Hub</title>
            </Head>
            <div className="max-w-3xl mx-auto px-4 text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">Cookie Policy</h1>
                <p className="text-gray-600 text-lg mb-8">
                    Our cookie policy is currently being prepared and will be available soon.
                </p>
                <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
                    &larr; Back to Home
                </Link>
            </div>
        </div>
    );
}
