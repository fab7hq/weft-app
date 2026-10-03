import { defineConfig } from 'vitest/config';

// Two kinds of test: the Worker's, in the Workers runtime, and the web app's.
export default defineConfig({
  test: {
    projects: [
      './worker/vitest.config.ts',
      // The Worker's own code where Node is needed: writing a fixture.
      { test: { name: 'worker-node', include: ['worker/test/**/*.node.test.ts'] } },
      { test: { name: 'web', include: ['web/test/**/*.test.ts'] } },
    ],
  },
});
