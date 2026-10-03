import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: path.join(import.meta.dirname, '../wrangler.jsonc') },
      miniflare: {
        bindings: {
          GITHUB_CLIENT_SECRET: 'test-secret',
          // A key for tests only; the service's own is a Worker secret.
          ASSERTION_KEY: readFileSync(path.join(import.meta.dirname, 'test/fixtures/test-assertion-key.pem'), 'utf8'),
          TEST_ASSERTION_PUBLIC: readFileSync(path.join(import.meta.dirname, 'test/fixtures/test-assertion-key.pub'), 'utf8').trim(),
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, '../migrations')),
        },
      },
    })),
  ],
  test: {
    name: 'worker',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.node.test.ts'],
    setupFiles: ['./test/migrations.ts'],
  },
});
