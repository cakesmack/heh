/**
 * Date utility functions for event filtering
 * Handles local timezone correctly for date range calculations
 */

/**
 * Get the start of a day in local timezone, returned as ISO string
 */
const startOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * Get the end of a day in local timezone, returned as ISO string
 */
const endOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

/**
 * Add days to a date
 */
const addDays = (date: Date, days: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

export const getDateRangeFromFilter = (
    filter: string,
    customFrom?: string,
    customTo?: string
): { date_from?: string; date_to?: string } => {
    const result: { date_from?: string; date_to?: string } = {};

    if (!filter) return result;

    if (filter === 'custom') {
        if (customFrom) {
            // Parse the date string and set to start of day in local time
            const fromDate = new Date(customFrom + 'T00:00:00');
            result.date_from = fromDate.toISOString();
        }
        if (customTo) {
            // Parse the date string and set to end of day in local time
            const toDate = new Date(customTo + 'T23:59:59.999');
            result.date_to = toDate.toISOString();
        } else if (customFrom && !customTo) {
            // If only one date selected, use same day for both
            const toDate = new Date(customFrom + 'T23:59:59.999');
            result.date_to = toDate.toISOString();
        }
        return result;
    }

    // Get today's date at midnight local time
    const today = startOfDay(new Date());

    if (filter === 'today') {
        result.date_from = today.toISOString();
        result.date_to = endOfDay(today).toISOString();
    } else if (filter === 'tomorrow') {
        // Tomorrow: add exactly 1 day to today
        const tomorrow = addDays(today, 1);
        result.date_from = startOfDay(tomorrow).toISOString();
        result.date_to = endOfDay(tomorrow).toISOString();
    } else if (filter === 'weekend') {
        // Find next Saturday (or today if already Saturday)
        const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        let daysUntilSaturday = (6 - dayOfWeek + 7) % 7;

        // If today is Saturday, use today; if Sunday, use today
        if (dayOfWeek === 6) {
            daysUntilSaturday = 0; // It's Saturday
        } else if (dayOfWeek === 0) {
            daysUntilSaturday = 0; // It's Sunday, show today
        }

        const saturday = addDays(today, daysUntilSaturday);
        const sunday = addDays(saturday, dayOfWeek === 0 ? 0 : 1);

        result.date_from = startOfDay(saturday).toISOString();
        result.date_to = endOfDay(sunday).toISOString();
    } else if (filter === 'week') {
        result.date_from = today.toISOString();
        result.date_to = endOfDay(addDays(today, 7)).toISOString();
    } else if (filter === 'month') {
        result.date_from = today.toISOString();
        result.date_to = endOfDay(addDays(today, 30)).toISOString();
    }

    return result;
};
