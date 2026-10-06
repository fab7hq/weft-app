import { defineConfig, devices } from '@playwright/test';

// The web app against the real Worker and a local D1 under `wrangler dev`
// (web-app.md §11), over HTTPS as on weft.getfab7.com: WebKit sends the
// Secure session cookie only there. Chromium in each profile's size and
// touch, and the phone again on WebKit.
// Chromium registers a service worker on the test certificate only when told to trust it.
const trusting = { launchOptions: { args: ['--ignore-certificate-errors'] } };
const as = (name: keyof typeof devices) => ({ ...devices[name], ...trusting, browserName: 'chromium' as const, defaultBrowserType: 'chromium' as const });

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'https://localhost:8788', serviceWorkers: 'allow', ignoreHTTPSErrors: true },
  projects: [
    { name: 'iphone', use: as('iPhone 15'), testIgnore: /(desktop.*|layout|gallery)\.spec/ },
    { name: 'ipad', use: as('iPad Pro 11'), testMatch: /(shell|layout)\.spec/ },
    // Safari's engine: the same phone tests on WebKit, the browser an iPhone really has.
    { name: 'iphone-webkit', use: devices['iPhone 15'], testIgnore: /(desktop.*|layout|gallery)\.spec/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...trusting }, testMatch: /(shell|desktop|atlas-.*)\.spec/ },
    // Notifications need the whole browser, which the default headless shell is not.
    { name: 'desktop-push', use: { ...devices['Desktop Chrome'], ...trusting, channel: 'chromium' }, testMatch: /desktop-push\.spec/ },
    // `npm run gallery`: every web screen at its Atlas frame.
    { name: 'gallery-phone', use: { ...as('iPhone 15'), viewport: { width: 390, height: 844 } }, testMatch: /gallery\.spec/ },
    { name: 'gallery-desktop', use: { ...devices['Desktop Chrome'], ...trusting, viewport: { width: 1280, height: 800 } }, testMatch: /gallery\.spec/ },
  ],
  webServer: {
    command:
      'node e2e/dev-vars.mjs && npx vite build web && npx wrangler d1 migrations apply weft --local --persist-to .wrangler/e2e && npx wrangler dev --port 8788 --local-protocol https --persist-to .wrangler/e2e',
    url: 'https://localhost:8788/',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
