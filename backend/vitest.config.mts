import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 90000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});