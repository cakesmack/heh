import React, { useState } from 'react';
import Link from 'next/link';
import Modal from './Modal';
import { AdminAnalyticsSummary, MissedOpportunitiesResponse, SupplyGap, QualityIssue, CategoryMixStats, OrganizerEventStats } from '@/types';
import { analyticsAPI } from '@/lib/api';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
    children?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, trend, className = '', children }) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full ${className}`}>
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
            {trend && (
                <div className={`flex items-center px-2 py-1 rounded-full text-xs font-semibold ${trend.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend.isPositive ? (
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                    ) : (
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    )}
                    {Math.abs(trend.value)}%
                </div>
            )}
        </div>
        <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{value}</span>
            {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
        </div>
        {children && <div className="mt-4 flex-1">{children}</div>}
    </div>
);

export const ConversionFunnelWidget: React.FC<{ analytics: AdminAnalyticsSummary }> = ({ analytics }) => {
    const views = analytics.total_event_views || 0;
    const clicks = analytics.total_ticket_clicks || 0;
    const rate = analytics.conversion_rate || 0;

    return (
        <StatCard title="Conversion Funnel" value={`${rate}%`} subtitle="Avg. Rate">
            <div className="mt-4 space-y-4">
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Event Views</span>
                        <span className="font-semibold">{views.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full w-full"></div>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Ticket Clicks</span>
                        <span className="font-semibold">{clicks.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-emerald-500 h-full transition-all duration-1000"
                            style={{ width: `${rate}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </StatCard>
    );
};

export const MissedOpportunitiesWidget: React.FC<{ missed: MissedOpportunitiesResponse }> = ({ missed }) => {
    const [clearing, setClearing] = React.useState(false);
    const [showAll, setShowAll] = React.useState(false);

    // Only show Topic gaps, ignore Location gaps as requested
    const allGaps = missed.missing_topics.map(t => ({ ...t, type: 'Topic' }))
        .sort((a, b) => b.count - a.count);

    const topGaps = allGaps.slice(0, 5);

    const handleClear = async () => {
        if (!confirm("Clear all failed search history? This cannot be undone.")) return;
        setClearing(true);
        try {
            await analyticsAPI.clearMissedOpportunities();
            window.location.reload(); // Simple refresh for now
        } catch (e) {
            console.error(e);
            alert("Failed to clear history");
        } finally {
            setClearing(false);
        }
    };

    return (
        <>
            <StatCard title="Missed Opportunities" value={missed.total_failed_searches} subtitle="Failed Searches">
                <div className="absolute top-4 right-4">
                    <button
                        onClick={handleClear}
                        disabled={clearing || missed.total_failed_searches === 0}
                        className="text-xs text-gray-400 hover:text-gray-900 disabled:opacity-50"
                        title="Clear History"
                    >
                        {clearing ? "..." : "Dismiss All"}
                    </button>
                </div>
                <div className="mt-4 space-y-3">
                    {topGaps.map((gap, i) => (
                        <div key={`${gap.type}-${gap.term}`} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}.</span>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs text-gray-700 truncate font-medium">"{gap.term}"</span>
                                    {/* <span className="text-[9px] text-gray-400 uppercase tracking-tighter">{gap.type}</span> */}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">
                                {gap.count}×
                            </span>
                        </div>
                    ))}
                    {topGaps.length === 0 && (
                        <p className="text-xs text-gray-400 italic text-center py-4">No content gaps detected</p>
                    )}
                </div>
                {allGaps.length > 5 && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="mt-4 w-full py-2 text-[10px] font-bold text-gray-500 hover:text-gray-900 uppercase tracking-widest border-t border-gray-50 transition-colors"
                    >
                        View All {allGaps.length} Gaps
                    </button>
                )}
            </StatCard>

            {/* View All Modal */}
            {showAll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">All Missed Opportunities</h2>
                                <p className="text-sm text-gray-500">Failed searches from the last 30 days</p>
                            </div>
                            <button
                                onClick={() => setShowAll(false)}
                                className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-600 shadow-sm border border-transparent hover:border-gray-100"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 gap-8">
                                {/* Topics Section */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                        Topic Searches ({missed.missing_topics.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {missed.missing_topics.map((gap, i) => (
                                            <div key={gap.term} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                                                <span className="text-sm text-gray-700 font-medium">"{gap.term}"</span>
                                                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                                                    {gap.count}×
                                                </span>
                                            </div>
                                        ))}
                                        {missed.missing_topics.length === 0 && (
                                            <p className="text-sm text-gray-400 italic">No failed topic searches</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                            <button
                                onClick={() => setShowAll(false)}
                                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export const TopContentWidget: React.FC<{ analytics: AdminAnalyticsSummary }> = ({ analytics }) => (
    <StatCard title="Top Content" value={analytics.top_events.length} subtitle="Trending Events">
        <div className="mt-4 space-y-3">
            {analytics.top_events.length > 0 ? (
                analytics.top_events.slice(0, 5).map((event, i) => (
                    <div key={event.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}.</span>
                            <span className="text-xs text-gray-700 truncate group-hover:text-emerald-600 transition-colors">
                                {event.title}
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400">
                            {event.views.toLocaleString()}
                        </span>
                    </div>
                ))
            ) : (
                <p className="text-xs text-gray-400 italic text-center py-4">No data yet</p>
            )}
        </div>
    </StatCard>
);

export const SupplyGapWidget: React.FC<{ gaps: SupplyGap[] }> = ({ gaps }) => {
    return (
        <StatCard title="Ghost Town Alert" value={gaps.length} subtitle="Days with low supply" trend={{ value: gaps.length, isPositive: gaps.length === 0 }}>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
                {gaps.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">No gaps detected. Good job!</div>
                ) : (
                    gaps.map(gap => (
                        <div key={gap.date} className="flex-shrink-0 bg-rose-50 border border-rose-100 rounded-lg p-2 w-24 flex flex-col items-center">
                            <span className="text-[10px] uppercase font-bold text-rose-400">{new Date(gap.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                            <span className="text-sm font-bold text-gray-900">{new Date(gap.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            <span className="mt-1 text-[10px] font-bold text-rose-600 bg-white px-1.5 py-0.5 rounded-full shadow-sm border border-rose-100">
                                {gap.event_count} active
                            </span>
                        </div>
                    ))
                )}
            </div>
        </StatCard>
    );
};

export const QualityIssuesWidget: React.FC<{ issues: QualityIssue[] }> = ({ issues }) => {
    const totalIssues = issues.reduce((acc, curr) => acc + curr.count, 0);
    const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
    const [issueEvents, setIssueEvents] = useState<OrganizerEventStats[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const handleIssueClick = async (issueType: string) => {
        if (loadingDetails) return;
        setSelectedIssue(issueType);
        setLoadingDetails(true);
        try {
            const events = await analyticsAPI.getQualityIssueDetails(issueType);
            setIssueEvents(events);
        } catch (error) {
            console.error(error);
            setIssueEvents([]);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleClose = () => {
        setSelectedIssue(null);
        setIssueEvents([]);
    };

    return (
        <StatCard title="Quality Control" value={totalIssues} subtitle="Issues to Fix">
            <div className="mt-4 space-y-3">
                {issues.map(issue => (
                    <div
                        key={issue.issue_type}
                        className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer hover:bg-gray-50 ${selectedIssue === issue.issue_type ? 'bg-gray-50 rings-1 ring-gray-200' : ''}`}
                        onClick={() => handleIssueClick(issue.issue_type)}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${issue.count > 0 ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                            <span className="text-xs font-medium text-gray-600 capitalize">
                                {issue.issue_type.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${issue.count > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                                {issue.count}
                            </span>
                            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                ))}
                {totalIssues === 0 && (
                    <p className="text-xs text-emerald-600 font-medium text-center py-2 bg-emerald-50 rounded-lg">All clean!</p>
                )}
            </div>

            {/* Details Modal */}
            {selectedIssue && (
                <Modal
                    isOpen={!!selectedIssue}
                    onClose={handleClose}
                    title={`Fix: ${selectedIssue.replace('_', ' ')}`}
                    size="lg"
                >
                    <div className="max-h-[60vh] overflow-y-auto p-1">
                        {loadingDetails ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                            </div>
                        ) : issueEvents.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No events found for this issue type.</div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-500 mb-4">The following events have been flagged. Click to edit and resolve.</p>
                                {issueEvents.map(event => (
                                    <div key={event.event_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                                        <div className="min-w-0 flex-1 mr-4">
                                            <h4 className="text-sm font-medium text-gray-900 truncate">{event.title}</h4>
                                            <p className="text-xs text-gray-400">ID: {event.event_id.substring(0, 8)}...</p>
                                        </div>
                                        <Link
                                            href={`/events/${event.event_id}/edit`}
                                            target="_blank"
                                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                        >
                                            Fix Issue &rarr;
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </StatCard>
    );
};

export const CategoryMixWidget: React.FC<{ mix: CategoryMixStats[] }> = ({ mix }) => {
    // Sort by percentage desc
    const sortedMix = [...mix].sort((a, b) => b.percentage - a.percentage).slice(0, 5);

    return (
        <StatCard title="Inventory Balance" value={`${mix.length}`} subtitle="Active Categories">
            <div className="mt-4 space-y-3">
                {sortedMix.map(cat => (
                    <div key={cat.category_name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="font-medium text-gray-600 truncate max-w-[70%]">{cat.category_name}</span>
                            <span className="text-gray-400">{cat.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-indigo-500 h-full rounded-full"
                                style={{ width: `${cat.percentage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </StatCard>
    );
};

export const PerformanceLeaderboardWidget: React.FC<{ events: OrganizerEventStats[] }> = ({ events }) => {
    return (
        <StatCard title="Top Performers" value={events.length} subtitle="High Engagement">
            <div className="mt-4 space-y-3">
                {events.length > 0 ? (
                    events.map((event, i) => (
                        <div key={event.event_id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}.</span>
                                <span className="text-xs text-gray-700 truncate group-hover:text-indigo-600 transition-colors cursor-pointer" title={event.title}>
                                    {event.title}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-gray-900 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                {event.views.toLocaleString()}
                            </span>
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-gray-400 italic text-center py-4">No data yet</p>
                )}
            </div>
        </StatCard>
    );
};
