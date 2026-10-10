import { defineConfig } from 'vitest/config';

// Unit tests: no database, no network.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: { NODE_ENV: 'test' },
  },
});
