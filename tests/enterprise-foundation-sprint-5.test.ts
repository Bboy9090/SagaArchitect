import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateServerEnvironment } from '../src/lib/env-validator';
import {
  assetObjectExists,
  createAssetStorageKey,
  deleteAssetObject,
  readAssetObject,
  saveAssetObject,
} from '../src/lib/storage/asset-storage';
import { resetStorageProviderForTests } from '../src/lib/storage/index';

function validStagingEnvironment(): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'staging',
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://runtime.example/staging',
    DATABASE_MIGRATION_URL: 'postgresql://migration.example/staging',
    NEXTAUTH_SECRET: 'staging-secret-that-is-at-least-thirty-two-characters',
    NEXTAUTH_URL: 'https://staging.phoenix-creator.example',
    STORAGE_PROVIDER: 'supabase',
    SUPABASE_URL: 'https://staging-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'staging-service-role',
    SUPABASE_STORAGE_BUCKET: 'private-staging-assets',
    RATE_LIMIT_PROVIDER: 'upstash',
    RATE_LIMIT_URL: 'https://staging-rate-limit.upstash.io',
    RATE_LIMIT_TOKEN: 'staging-rate-limit-token',
    DEPLOYMENT_COMMIT_SHA: 'a'.repeat(40),
    ROLLBACK_COMMIT_SHA: 'b'.repeat(40),
    STAGING_CONFIRM_ISOLATED: 'true',
  };
}

test('staging deployment validator accepts the approved isolated architecture', () => {
  const result = validateServerEnvironment(validStagingEnvironment(), 'deployment');
  assert.equal(result.ok, true);
  assert.equal(result.value?.appEnvironment, 'staging');
  assert.equal(result.value?.storageProvider, 'supabase');
  assert.equal(result.value?.rateLimitProvider, 'upstash');
  assert.equal(result.value?.stagingConfirmedIsolated, true);
});

test('staging deployment validator rejects shared URLs, wrong providers, and missing isolation evidence', () => {
  const env = validStagingEnvironment();
  env.DATABASE_MIGRATION_URL = env.DATABASE_URL;
  env.STORAGE_PROVIDER = 's3';
  env.RATE_LIMIT_PROVIDER = 'redis';
  env.STAGING_CONFIRM_ISOLATED = 'false';
  const result = validateServerEnvironment(env, 'deployment');
  assert.equal(result.ok, false);
  const messages = result.issues.map((issue) => issue.message).join('\n');
  assert.match(messages, /Runtime and migration database URLs must be separate/);
  assert.match(messages, /requires Supabase Storage/);
  assert.match(messages, /requires Upstash rate limiting/);
  assert.match(messages, /STAGING_CONFIRM_ISOLATED=true/);
});

test('staging validator rejects localhost auth and incomplete evidence SHAs', () => {
  const env = validStagingEnvironment();
  env.NEXTAUTH_URL = 'https://localhost:3000';
  env.DEPLOYMENT_COMMIT_SHA = 'abc123';
  env.ROLLBACK_COMMIT_SHA = '';
  const result = validateServerEnvironment(env, 'deployment');
  assert.equal(result.ok, false);
  const keys = new Set(result.issues.map((issue) => issue.key));
  assert.equal(keys.has('NEXTAUTH_URL'), true);
  assert.equal(keys.has('DEPLOYMENT_COMMIT_SHA'), true);
  assert.equal(keys.has('ROLLBACK_COMMIT_SHA'), true);
});

test('asset storage keys are generated from validated IDs rather than filenames', () => {
  const key = createAssetStorageKey('77777777-7777-4777-8777-777777777777', '.PNG');
  assert.equal(key, 'assets/77777777-7777-4777-8777-777777777777.png');
  assert.throws(() => createAssetStorageKey('not-a-uuid', '.png'));
  assert.throws(() => createAssetStorageKey('77777777-7777-4777-8777-777777777777', '../png'));
});

test('provider-neutral asset operations preserve private bytes through the local test adapter', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pcs-asset-storage-'));
  const previousPath = process.env.STORAGE_PATH;
  const previousProvider = process.env.STORAGE_PROVIDER;
  process.env.STORAGE_PATH = root;
  process.env.STORAGE_PROVIDER = 'local';
  resetStorageProviderForTests();

  const assetId = '77777777-7777-4777-8777-777777777777';
  try {
    const stored = await saveAssetObject({
      assetId,
      extension: '.png',
      data: new Uint8Array([1, 2, 3, 4]),
      contentType: 'image/png',
      provider: 'local',
    });
    assert.equal(stored.storageProvider, 'local');
    assert.equal(stored.storageReference, `assets/${assetId}.png`);
    assert.equal(await assetObjectExists('local', stored.storageReference), true);
    assert.deepEqual([...await readAssetObject('local', stored.storageReference)], [1, 2, 3, 4]);
    await deleteAssetObject('local', stored.storageReference);
    assert.equal(await assetObjectExists('local', stored.storageReference), false);
  } finally {
    resetStorageProviderForTests();
    if (previousPath === undefined) delete process.env.STORAGE_PATH;
    else process.env.STORAGE_PATH = previousPath;
    if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = previousProvider;
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});
