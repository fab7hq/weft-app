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
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, '../migrations')),
        },
      },
    })),
  ],
  test: {
    name: 'worker',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/migrations.ts'],
  },
});
