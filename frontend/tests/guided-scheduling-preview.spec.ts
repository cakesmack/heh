import { expect, test, type Page } from '@playwright/test';

const venue = {
  id: 'schedule-venue', name: 'Eden Court Theatre', address: 'Bishops Road, Inverness',
  latitude: 57.473, longitude: -4.23, owner_id: 'preview-owner', status: 'VERIFIED',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/venues/search?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ venues: [venue], total: 1 }),
  }));
});

async function reachSchedule(page: Page) {
  await page.goto('/create-event-preview');
  await expect(page.getByRole('heading', { name: 'What is your event called?' })).toBeFocused();
  if ((page.viewportSize()?.width ?? 1280) >= 1024) await expect(page.getByRole('button', { name: 'Schedule comes later' })).toBeDisabled();
  await page.locator('#guided-event-title').fill('Scheduling Preview');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Where is it happening?' })).toBeFocused();
  await page.locator('#guided-event-venue').fill('Eden');
  await page.getByRole('button', { name: /Eden Court Theatre Bishops Road/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'When does your event happen?' })).toBeFocused();
  if ((page.viewportSize()?.width ?? 1280) >= 1024) await expect(page.getByRole('button', { name: 'Edit Schedule' })).toBeEnabled();
}

test('single events validate finish order, support overnight dates and preserve answers', async ({ page }) => {
  await reachSchedule(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose how your event is scheduled.')).toBeVisible();
  await page.getByText('Just once', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'When does it start?' })).toBeFocused();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose the start date.')).toBeVisible();
  await page.locator('#schedule-once-start').fill('2026-10-09');
  await page.locator('#schedule-once-start_hour').selectOption('19');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'When does it finish?' })).toBeFocused();
  await page.locator('#schedule-once-end').fill('2026-10-09');
  await page.locator('#schedule-once-end_hour').selectOption('18');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('The finish must be after the start.')).toBeVisible();
  await page.locator('#schedule-once-end').fill('2026-10-10');
  await page.locator('#schedule-once-end_hour').selectOption('02');
  await expect(page.getByTestId('desktop-summary')).toContainText('UK time');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('#schedule-once-start')).toHaveValue('2026-10-09');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#schedule-once-end')).toHaveValue('2026-10-10');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('status')).toContainText('No event has been created.');
});

test('all-day dates and clock-change times are validated as UK local times', async ({ page }) => {
  await reachSchedule(page);
  await page.getByText('Just once', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#schedule-once-start').fill('2027-03-28');
  await page.locator('#schedule-once-start_hour').selectOption('01');
  await page.locator('#schedule-once-start_minute').selectOption('30');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/does not exist when the clocks change/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'All day event' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#schedule-once-end').fill('2027-03-29');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('status')).toContainText('No event has been created.');
});

test('several dates allow independent performances, reuse, sorting and removal', async ({ page }) => {
  await reachSchedule(page);
  await page.getByText('Several dates or times', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Add at least one performance.')).toBeVisible();
  await page.getByRole('button', { name: 'Add another date or time' }).click();
  await page.locator('input[type="date"][id^="performance-start-"]').fill('2026-10-17');
  await page.locator('select[id^="performance-start-"][id$="_hour"]').selectOption('14');
  await page.locator('input[type="date"][id^="performance-end-"]').fill('2026-10-17');
  await page.locator('select[id^="performance-end-"][id$="_hour"]').selectOption('16');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Reuse times' }).click();
  await expect(page.getByTestId('desktop-summary')).toContainText('2 performances');
  await page.locator('input[type="date"][id^="performance-start-"]').fill('2026-10-17');
  await page.locator('input[type="date"][id^="performance-end-"]').fill('2026-10-17');
  await page.locator('select[id^="performance-start-"][id$="_hour"]').selectOption('15');
  await page.locator('select[id^="performance-end-"][id$="_hour"]').selectOption('17');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Performances overlap or repeat. Give each one a distinct time.')).toBeVisible();
  await page.locator('select[id^="performance-start-"][id$="_hour"]').selectOption('19');
  await page.locator('select[id^="performance-end-"][id$="_hour"]').selectOption('21');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Remove performance 2' }).click();
  await expect(page.getByTestId('desktop-summary')).toContainText('1 performance');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByText('Just once', { exact: true }).click();
  await page.getByText('Several dates or times', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Remove performance 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('status')).toContainText('No event has been created.');
});

test('recurring settings retain interval, weekdays, end choice and rule summary', async ({ page }) => {
  await reachSchedule(page);
  await page.getByText('It repeats regularly', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#recurrence-first-date').fill('2026-10-09');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#recurrence-interval').fill('2');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose at least one weekday.')).toBeVisible();
  await page.getByRole('button', { name: 'Fri', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#recurrence-end-date').fill('2026-12-18');
  await expect(page.getByTestId('desktop-summary')).toContainText('Every 2 weeks on Fri');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('#recurrence-interval')).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Fri', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#recurrence-end-date')).toHaveValue('2026-12-18');
  await page.getByRole('radio', { name: 'Ongoing' }).check();
  await expect(page.getByText(/Automatic future-date generation/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('status')).toContainText('No event has been created.');
});

test('scheduling choices and live summary fit the mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await reachSchedule(page);
  await expect(page.getByTestId('mobile-summary')).toBeVisible();
  await expect(page.getByTestId('desktop-summary')).toBeHidden();
  await page.getByText('Several dates or times', { exact: true }).click();
  await page.getByTestId('mobile-summary').locator('summary').click();
  await expect(page.getByTestId('mobile-summary')).toContainText('Several dates or times');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
