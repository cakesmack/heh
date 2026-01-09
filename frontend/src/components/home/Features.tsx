import React from 'react';

const Features = () => {
    return (
        <section className="bg-white py-16 md:py-24 border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
                    {/* Column 1 */}
                    <div className="flex flex-col items-center text-center">
                        <div className="bg-emerald-50 p-4 rounded-2xl mb-6">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">The One Source</h3>
                        <p className="text-emerald-700 font-medium mb-4">Uncover the Highlands.</p>
                        <p className="text-gray-600 leading-relaxed max-w-sm">
                            You shouldn't need to check five venue websites, three Facebook groups, and the local paper just to plan your weekend. We bring the entire Highlands onto one map so you can discover the hidden gems, village hall gigs, and local festivals you'd otherwise miss.
                        </p>
                    </div>

                    {/* Column 2 */}
                    <div className="flex flex-col items-center text-center">
                        <div className="bg-emerald-50 p-4 rounded-2xl mb-6">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Real Events Only</h3>
                        <p className="text-emerald-700 font-medium mb-4">Zero Spam.</p>
                        <p className="text-gray-600 leading-relaxed max-w-sm">
                            Global ticket sites are full of junk. We filter out the "get rich quick" webinars and generic online courses to give you a clean feed of live music, culture, and adventure. If it's listed here, it's happening here—in person.
                        </p>
                    </div>

                    {/* Column 3 */}
                    <div className="flex flex-col items-center text-center">
                        <div className="bg-emerald-50 p-4 rounded-2xl mb-6">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Built for Locals</h3>
                        <p className="text-emerald-700 font-medium mb-4">Curated, Not Cluttered.</p>
                        <p className="text-gray-600 leading-relaxed max-w-sm">
                            We aren't a generic algorithm scraping the whole world. We focus strictly on the Highlands, monitoring hundreds of local sources to find the events that don't always make it to the big ticket sites.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Features;
