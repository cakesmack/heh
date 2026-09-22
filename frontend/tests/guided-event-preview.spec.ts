import { expect, test } from '@playwright/test';

const venues = [{
  id: 'venue-preview-1', name: 'Eden Court Theatre', address: 'Bishops Road, Inverness IV3 5SA',
  latitude: 57.473, longitude: -4.23, owner_id: 'preview-owner',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', status: 'VERIFIED',
}, {
  id: 'venue-preview-2', name: 'Inverness Town House', address: 'High Street, Inverness IV1 1JJ',
  latitude: 57.479, longitude: -4.224, owner_id: 'preview-owner',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', status: 'VERIFIED',
}];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/venues/search?**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() || '';
    const matches = venues.filter((venue) => venue.name.toLowerCase().includes(query));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ venues: matches, total: matches.length }) });
  });
});

test('validates, navigates, preserves answers and never creates a venue', async ({ page }) => {
  let venueCreateRequests = 0;
  await page.route('**/api/venues', async (route) => {
    if (route.request().method() === 'POST') venueCreateRequests += 1;
    await route.abort('blockedbyclient');
  });

  await page.goto('/create-event-preview');
  await expect(page.getByRole('heading', { name: 'What is your event called?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#guided-title-error')).toHaveText('Add an event name before continuing.');
  await expect(page.locator('#guided-event-title')).toBeFocused();

  await page.locator('#guided-event-title').fill('Highland Storytelling Night');
  await expect(page.getByTestId('desktop-summary')).toContainText('Highland Storytelling Night');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Where is it happening?' })).toBeFocused();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose a registered venue before continuing.')).toBeVisible();
  await expect(page.locator('#guided-event-venue')).toBeFocused();

  await page.locator('#guided-event-venue').fill('Eden');
  await expect(page.getByRole('button', { name: /Eden Court Theatre Bishops Road/ })).toBeVisible();
  await page.getByRole('button', { name: /Eden Court Theatre Bishops Road/ }).click();
  await expect(page.getByTestId('desktop-summary')).toContainText('Eden Court Theatre');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('#guided-event-title')).toHaveValue('Highland Storytelling Night');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#guided-event-venue')).toHaveValue('Eden Court Theatre');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'When does your event happen?' })).toBeFocused();
  expect(venueCreateRequests).toBe(0);
});

test('supports multiple venues, deduplicates, removes and preserves both venue modes', async ({ page }) => {
  let venueCreateRequests = 0;
  await page.route('**/api/venues', async (route) => {
    if (route.request().method() === 'POST') venueCreateRequests += 1;
    await route.abort('blockedbyclient');
  });

  await page.goto('/create-event-preview');
  await expect(page.getByRole('heading', { name: 'What is your event called?' })).toBeFocused();
  await page.locator('#guided-event-title').fill('Highland Arts Trail');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Multiple venues', { exact: true }).click();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Add at least one participating venue before continuing.')).toBeVisible();

  await page.locator('#guided-event-venue').fill('Eden');
  await page.getByRole('button', { name: /Eden Court Theatre Bishops Road/ }).click();
  await expect(page.getByTestId('desktop-summary')).toContainText('1 venue · Eden Court Theatre');

  await page.locator('#guided-event-venue').fill('Town');
  await page.getByRole('button', { name: /Inverness Town House High Street/ }).click();
  await expect(page.getByTestId('desktop-summary')).toContainText('2 venues · Eden Court Theatre, Inverness Town House');

  await page.locator('#guided-event-venue').fill('Eden');
  await page.getByRole('button', { name: /Eden Court Theatre Bishops Road/ }).click();
  await expect(page.getByRole('button', { name: 'Remove Eden Court Theatre' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Remove / })).toHaveCount(2);

  await page.getByRole('button', { name: 'Remove Eden Court Theatre' }).click();
  await expect(page.getByTestId('desktop-summary')).toContainText('1 venue · Inverness Town House');

  await page.getByText('One venue', { exact: true }).click();
  await page.locator('#guided-event-venue').fill('Eden');
  await page.getByRole('button', { name: /Eden Court Theatre Bishops Road/ }).click();
  await expect(page.getByTestId('desktop-summary')).toContainText('Eden Court Theatre');

  await page.getByText('Multiple venues', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Inverness Town House' })).toBeVisible();
  await page.getByText('One venue', { exact: true }).click();
  await expect(page.locator('#guided-event-venue')).toHaveValue('Eden Court Theatre');

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#guided-event-venue')).toHaveValue('Eden Court Theatre');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'When does your event happen?' })).toBeFocused();
  expect(venueCreateRequests).toBe(0);
});

test('uses the compact expandable summary on mobile and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/create-event-preview');

  await expect(page.getByTestId('mobile-summary')).toBeVisible();
  await expect(page.getByTestId('desktop-summary')).toBeHidden();
  await page.locator('#guided-event-title').fill('Mobile Preview Event');
  await page.getByTestId('mobile-summary').locator('summary').click();
  await expect(page.getByTestId('mobile-summary')).toContainText('Mobile Preview Event');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Where is it happening?' })).toBeFocused();
  await expect(page.getByTestId('guided-question-panel')).toHaveCSS('animation-duration', '0s');
});
