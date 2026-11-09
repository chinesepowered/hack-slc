import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
