import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const localTestDatabaseUrl = 'postgresql://borneo_app:local_borneo_password@localhost:5433/borneo_tracker_test?schema=public';
const configuredDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const databaseUrl = configuredDatabaseUrl && new URL(configuredDatabaseUrl).pathname.endsWith('_test')
  ? configuredDatabaseUrl
  : localTestDatabaseUrl;

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
    },
    globalSetup: ['./tests/globalSetup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: { reporter: ['text', 'html'] },
  },
});
