import { expect, test } from '@playwright/test';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

test('local application shell renders the custom 404 page', async ({ page }) => {
  const externalRequests: string[] = [];

  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const isLocalHttp =
      (requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:') &&
      LOOPBACK_HOSTS.has(requestUrl.hostname);
    const isBrowserLocal = ['about:', 'blob:', 'data:'].includes(requestUrl.protocol);

    if (isLocalHttp || isBrowserLocal) {
      await route.continue();
      return;
    }

    externalRequests.push(requestUrl.href);
    await route.abort('blockedbyclient');
  });

  const response = await page.goto('/__frontend_baseline_missing_route__');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByText('Page not found')).toBeVisible();
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  expect(externalRequests).toEqual([]);
});
