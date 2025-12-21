/**
 * AdminHealthStrip
 * Compact single-row platform stats component
 */

interface HealthStripProps {
    stats: {
        total_users: number;
        new_users_week?: number;
        total_events: number;
        pending_events: number;
        total_venues: number;
        total_organizers?: number;
        pending_reports?: number;
    } | null;
    loading?: boolean;
}

export default function AdminHealthStrip({ stats, loading = false }: HealthStripProps) {
    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-4 animate-pulse">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded" />
                    ))}
                </div>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-100">
                {/* Users */}
                <div className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900">{stats.total_users}</p>
                    <p className="text-sm text-gray-500">Users</p>
                    {stats.new_users_week !== undefined && stats.new_users_week > 0 && (
                        <p className="text-xs text-emerald-600 mt-1">+{stats.new_users_week} this week</p>
                    )}
                </div>

                {/* Events */}
                <div className="p-4 text-center">
                    <div className="flex items-baseline justify-center space-x-2">
                        <p className="text-3xl font-bold text-gray-900">{stats.total_events}</p>
                        {stats.pending_events > 0 && (
                            <span className="text-sm font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                {stats.pending_events} pending
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">Events</p>
                </div>

                {/* Venues */}
                <div className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900">{stats.total_venues}</p>
                    <p className="text-sm text-gray-500">Venues</p>
                </div>

                {/* Organizers */}
                <div className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900">{stats.total_organizers ?? 0}</p>
                    <p className="text-sm text-gray-500">Organizers</p>
                </div>

                {/* Reports */}
                <div className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900">{stats.pending_reports ?? 0}</p>
                    <p className="text-sm text-gray-500">Reports</p>
                </div>
            </div>
        </div>
    );
}
