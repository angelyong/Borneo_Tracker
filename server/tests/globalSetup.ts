import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const require = createRequire(import.meta.url);
const localTestDatabaseUrl = 'postgresql://borneo_app:local_borneo_password@localhost:5433/borneo_tracker_test?schema=public';

const requireTestDatabase = (rawUrl: string) => {
  const url = new URL(rawUrl);
  const database = url.pathname.slice(1);
  if (!database.endsWith('_test') || !/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error(`Refusing to prepare a non-test database: ${database || '(missing)'}`);
  }
  return { url, database };
};

export default async function globalSetup() {
  const configuredUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  const rawUrl = configuredUrl && new URL(configuredUrl).pathname.endsWith('_test') ? configuredUrl : localTestDatabaseUrl;
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = rawUrl;
  const { url, database } = requireTestDatabase(rawUrl);

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (!existing.rowCount) await client.query(`CREATE DATABASE "${database}"`);
  } finally {
    await client.end();
  }

  const serverDirectory = fileURLToPath(new URL('..', import.meta.url));
  const prismaPackage = require.resolve('prisma/package.json');
  const prismaCli = join(dirname(prismaPackage), 'build', 'index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: serverDirectory,
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: rawUrl },
    stdio: 'inherit',
  });
}
