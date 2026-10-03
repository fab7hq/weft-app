// Step 32: the shell installs as an app and opens with no network to
// "No connection".
import { expect, test } from '@playwright/test';

test('the manifest makes it an app of its own', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  expect((await request.get('/icons/apple-touch-icon.png')).status()).toBe(200);
});

test('it opens offline to "No connection"', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load is taken by the worker once it controls the page.
  await page.reload();
  await expect(page.locator('body')).not.toContainText('No connection');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No connection' })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
});
