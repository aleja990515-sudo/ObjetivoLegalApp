import { defineConfig } from 'vitest/config';

export const DEFAULT_TEST_DATABASE_URL = 'postgres://objetivo:objetivo@localhost:5434/objetivo_test';

// Integration and e2e tests against the Podman test database (compose service
// `db-test`). Files run sequentially because they share and truncate that DB.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
      DATABASE_CA_CERT: '',
      APP_PASSWORD: 'clave-de-prueba',
      SESSION_SECRET: '',
      CRON_SECRET: 'cron-de-prueba',
      REVISION_CRON: 'off',
      VERCEL: '',
      VERCEL_REGION: '',
    },
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
