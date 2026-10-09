import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigurationError } from '../src/lib/api-errors';
import { buildDeploymentIdentity } from '../src/lib/deployment-identity';
import { validateServerEnvironment } from '../src/lib/env-validator';
import {
  assertIsolatedStagingNamespaces,
  configuredDatabaseSchema,
  configuredRateLimitNamespace,
} from '../src/lib/staging-isolation';

function repositoryFile(filePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

function stagingEnvironment(): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'staging',
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://runtime.example/staging',
    DATABASE_MIGRATION_URL: 'postgresql://migration.example/staging',
    DATABASE_SCHEMA: 'phoenix_staging',
    NEXTAUTH_SECRET: 'staging-secret-that-is-at-least-thirty-two-characters',
    NEXTAUTH_URL: 'https://staging.phoenix-creator.example',
    STORAGE_PROVIDER: 'supabase',
    SUPABASE_URL: 'https://staging-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'staging-service-role',
    SUPABASE_STORAGE_BUCKET: 'phoenix-staging-assets',
    RATE_LIMIT_PROVIDER: 'upstash',
    RATE_LIMIT_URL: 'https://staging-rate-limit.upstash.io',
    RATE_LIMIT_TOKEN: 'staging-rate-limit-token',
    RATE_LIMIT_NAMESPACE: 'pcs:staging:phoenix',
    DEPLOYMENT_COMMIT_SHA: 'a'.repeat(40),
    ROLLBACK_COMMIT_SHA: 'b'.repeat(40),
    STAGING_CONFIRM_ISOLATED: 'true',
  };
}

test('isolated staging namespace helpers accept bounded explicit namespaces', () => {
  const env = stagingEnvironment();
  assert.equal(configuredDatabaseSchema(env), 'phoenix_staging');
  assert.equal(configuredRateLimitNamespace(env), 'pcs:staging:phoenix');
  assert.deepEqual(assertIsolatedStagingNamespaces(env), {
    databaseSchema: 'phoenix_staging',
    rateLimitNamespace: 'pcs:staging:phoenix',
  });
});

test('isolated staging namespaces reject public, production, and malformed values', () => {
  assert.throws(
    () => assertIsolatedStagingNamespaces({ DATABASE_SCHEMA: 'public', RATE_LIMIT_NAMESPACE: 'pcs:staging:test' }),
    ConfigurationError,
  );
  assert.throws(
    () => assertIsolatedStagingNamespaces({ DATABASE_SCHEMA: 'phoenix_staging', RATE_LIMIT_NAMESPACE: 'pcs:production' }),
    ConfigurationError,
  );
  assert.throws(() => configuredDatabaseSchema({ DATABASE_SCHEMA: '../escape' }), ConfigurationError);
  assert.throws(() => configuredRateLimitNamespace({ RATE_LIMIT_NAMESPACE: 'bad namespace' }), ConfigurationError);
});

test('staging deployment policy requires isolated database and rate-limit namespaces', () => {
  const valid = validateServerEnvironment(stagingEnvironment(), 'deployment');
  assert.equal(valid.ok, true);
  assert.equal(valid.value?.databaseSchema, 'phoenix_staging');
  assert.equal(valid.value?.rateLimitNamespace, 'pcs:staging:phoenix');

  const invalid = stagingEnvironment();
  invalid.DATABASE_SCHEMA = 'public';
  invalid.RATE_LIMIT_NAMESPACE = 'pcs:rate-limit';
  const result = validateServerEnvironment(invalid, 'deployment');
  assert.equal(result.ok, false);
  const keys = new Set(result.issues.map((issue) => issue.key));
  assert.equal(keys.has('DATABASE_SCHEMA'), true);
  assert.equal(keys.has('RATE_LIMIT_NAMESPACE'), true);
});

test('deployment identity exposes non-secret isolation evidence', () => {
  const identity = buildDeploymentIdentity(stagingEnvironment());
  assert.equal(identity.databaseSchema, 'phoenix_staging');
  assert.equal(identity.rateLimitNamespace, 'pcs:staging:phoenix');
  assert.doesNotMatch(JSON.stringify(identity), /staging-service-role|staging-rate-limit-token/);
});

test('staging deployment migration is build-gated and never request-triggered', () => {
  const pkg = JSON.parse(repositoryFile('package.json')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.prebuild, /run-staging-deployment-migrations/);
  const migration = repositoryFile('scripts/run-staging-deployment-migrations.mjs');
  assert.match(migration, /RUN_STAGING_MIGRATIONS/);
  assert.match(migration, /APP_ENV/);
  assert.match(migration, /STAGING_CONFIRM_ISOLATED/);
  assert.match(migration, /migrationsSchema: schema/);
  assert.doesNotMatch(migration, /api\/|Request\(|NextResponse/);
});

test('staging workflow verifies exact namespace evidence from the deployed app', () => {
  const workflow = repositoryFile('.github/workflows/staging-acceptance.yml');
  assert.match(workflow, /STAGING_DATABASE_SCHEMA/);
  assert.match(workflow, /STAGING_RATE_LIMIT_NAMESPACE/);
  assert.match(workflow, /databaseSchema !== process\.env\.DATABASE_SCHEMA/);
  assert.match(workflow, /rateLimitNamespace !== process\.env\.RATE_LIMIT_NAMESPACE/);
});
