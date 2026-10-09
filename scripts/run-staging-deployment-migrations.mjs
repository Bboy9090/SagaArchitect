import fs from 'node:fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const evidencePath = 'staging-migration-evidence.json';
const appEnvironment = (process.env.APP_ENV || process.env.VERCEL_ENV || '').trim().toLowerCase();
const migrationEnabled = process.env.RUN_STAGING_MIGRATIONS === 'true';

if (appEnvironment !== 'staging' || !migrationEnabled) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: appEnvironment !== 'staging' ? 'not-staging' : 'migration-flag-disabled',
  }));
  process.exit(0);
}

const required = (key) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required for staging deployment migration.`);
  return value;
};
const schema = required('DATABASE_SCHEMA').toLowerCase();
if (!/^[a-z][a-z0-9_]{2,62}$/.test(schema) || schema === 'public') {
  throw new Error('DATABASE_SCHEMA must be a safe, non-public staging schema.');
}
if (process.env.STAGING_CONFIRM_ISOLATED !== 'true') {
  throw new Error('STAGING_CONFIRM_ISOLATED=true is required before staging migrations may run.');
}

const connectionString = required('DATABASE_MIGRATION_URL');
const startedAt = Date.now();
const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
  connection: { search_path: schema },
});

const evidence = {
  format: 'phoenix-creator-studio.staging-migration',
  version: 1,
  ok: false,
  schema,
  startedAt: new Date(startedAt).toISOString(),
};

try {
  await sql`create schema if not exists ${sql(schema)}`;
  const db = drizzle(sql);
  await migrate(db, {
    migrationsFolder: 'src/db/migrations',
    migrationsSchema: schema,
    migrationsTable: '__drizzle_migrations',
  });
  const tableCount = await sql`
    select count(*)::int as count
    from information_schema.tables
    where table_schema = ${schema}
  `;
  evidence.tableCount = Number(tableCount[0]?.count ?? 0);
  if (evidence.tableCount < 1) throw new Error('Staging migrations completed without creating application tables.');
  evidence.ok = true;
} finally {
  await sql.end({ timeout: 5 });
  evidence.completedAt = new Date().toISOString();
  evidence.durationMs = Date.now() - startedAt;
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(evidence, null, 2));
}

if (!evidence.ok) process.exitCode = 1;
