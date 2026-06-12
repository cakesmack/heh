import React from 'react';

export default function LocalPartners() {
    return (
        <section className="py-12 bg-white border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-8">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Local Partners
                    </h3>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 md:gap-12 items-center justify-items-center">
                    {/* Partner 1: Cairngorm Outdoors */}
                    <div className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-all duration-300 group cursor-default">
                        <svg className="w-6 h-6 opacity-50 group-hover:opacity-85 transition-opacity duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707" />
                        </svg>
                        <span className="font-extrabold text-sm tracking-tighter uppercase font-mono">CAIRNGORM</span>
                    </div>

                    {/* Partner 2: Loch Ness Cruises */}
                    <div className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-all duration-300 group cursor-default">
                        <svg className="w-6 h-6 opacity-50 group-hover:opacity-85 transition-opacity duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="font-semibold text-sm tracking-tight uppercase">NESS CRUISES</span>
                    </div>

                    {/* Partner 3: Highland Distillers */}
                    <div className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-all duration-300 group cursor-default">
                        <svg className="w-6 h-6 opacity-50 group-hover:opacity-85 transition-opacity duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-serif text-sm italic tracking-normal">Distillers Co.</span>
                    </div>

                    {/* Partner 4: Inverness Arts */}
                    <div className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-all duration-300 group cursor-default">
                        <svg className="w-6 h-6 opacity-50 group-hover:opacity-85 transition-opacity duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-sans font-bold text-sm tracking-widest uppercase">INV.ARTS</span>
                    </div>

                    {/* Partner 5: Hebridean Crafts */}
                    <div className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-all duration-300 group cursor-default">
                        <svg className="w-6 h-6 opacity-50 group-hover:opacity-85 transition-opacity duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span className="font-extrabold text-sm tracking-normal uppercase">HEB.CRAFTS</span>
                    </div>

                    {/* Partner 6: Orkney Sea Safaris */}
                    <div className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-all duration-300 group cursor-default">
                        <svg className="w-6 h-6 opacity-50 group-hover:opacity-85 transition-opacity duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className="font-sans font-light text-sm tracking-tighter uppercase">SEA SAFARIS</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
