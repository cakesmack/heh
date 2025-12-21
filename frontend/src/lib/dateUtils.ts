export const getDateRangeFromFilter = (
    filter: string,
    customFrom?: string,
    customTo?: string
): { date_from?: string; date_to?: string } => {
    const result: { date_from?: string; date_to?: string } = {};

    if (!filter) return result;

    if (filter === 'custom' && customFrom && customTo) {
        result.date_from = new Date(customFrom).toISOString();
        // Set end date to end of the day
        const endDate = new Date(customTo);
        endDate.setHours(23, 59, 59, 999);
        result.date_to = endDate.toISOString();
    } else {
        const today = new Date();

        if (filter === 'today') {
            result.date_from = today.toISOString();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            result.date_to = tomorrow.toISOString();
        } else if (filter === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            result.date_from = tomorrow.toISOString();
            const dayAfter = new Date(tomorrow);
            dayAfter.setDate(dayAfter.getDate() + 1);
            result.date_to = dayAfter.toISOString();
        } else if (filter === 'weekend') {
            // Simple logic for next weekend (Friday to Sunday)
            const friday = new Date();
            friday.setDate(friday.getDate() + (5 - friday.getDay() + 7) % 7);
            const sunday = new Date(friday);
            sunday.setDate(sunday.getDate() + 2);
            // Set to end of Sunday
            sunday.setHours(23, 59, 59, 999);

            result.date_from = friday.toISOString();
            result.date_to = sunday.toISOString();
        } else if (filter === 'week') {
            result.date_from = new Date().toISOString();
            result.date_to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (filter === 'month') {
            result.date_from = new Date().toISOString();
            result.date_to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }
    }

    return result;
};
