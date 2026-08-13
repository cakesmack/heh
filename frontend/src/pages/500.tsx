import Link from 'next/link';
import Head from 'next/head';

export default function Custom500() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 bg-gray-50">
            <Head>
                <title>Server Error | Highland Events Hub</title>
            </Head>
            <div className="text-center">
                <h1 className="text-9xl font-black text-gray-200">500</h1>
                <p className="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                    Internal Server Error
                </p>
                <p className="mt-4 text-base text-gray-500">
                    Sorry, something went wrong on our end. We&apos;re looking into it.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                    <Link
                        href="/"
                        className="rounded-md bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                        Go back home
                    </Link>
                    <Link href="/contact" className="text-sm font-semibold text-gray-900">
                        Contact support &rarr;
                    </Link>
                </div>
            </div>
        </div>
    );
}
