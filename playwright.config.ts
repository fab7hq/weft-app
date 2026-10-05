import { defineConfig, devices } from '@playwright/test';

// The web app against the real Worker and a local D1 under `wrangler dev`
// (web-app.md §11). Chromium in each profile's size and touch.
const as = (name: keyof typeof devices) => ({ ...devices[name], browserName: 'chromium' as const, defaultBrowserType: 'chromium' as const });

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:8788', serviceWorkers: 'allow' },
  projects: [
    { name: 'iphone', use: as('iPhone 15'), testIgnore: /(desktop.*|layout)\.spec/ },
    { name: 'ipad', use: as('iPad Pro 11'), testMatch: /(shell|layout)\.spec/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /(shell|desktop|atlas-.*)\.spec/ },
    // Notifications need the whole browser, which the default headless shell is not.
    { name: 'desktop-push', use: { ...devices['Desktop Chrome'], channel: 'chromium' }, testMatch: /desktop-push\.spec/ },
  ],
  webServer: {
    command:
      'node e2e/dev-vars.mjs && npx vite build web && npx wrangler d1 migrations apply weft --local --persist-to .wrangler/e2e && npx wrangler dev --port 8788 --persist-to .wrangler/e2e',
    url: 'http://localhost:8788/',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
