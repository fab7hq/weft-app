import { defineConfig } from 'vitest/config';

// Two kinds of test: the Worker's, in the Workers runtime, and the web app's.
export default defineConfig({
  test: {
    projects: ['./worker/vitest.config.ts', { test: { name: 'web', include: ['web/test/**/*.test.ts'] } }],
  },
});
