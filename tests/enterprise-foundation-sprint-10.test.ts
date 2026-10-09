import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertStagingAutomationRequest,
  isStagingTestEmail,
  stagingAutomationEnabled,
  StagingAutomationError,
} from '../src/lib/staging-automation';

function repositoryFile(filePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

const token = 'a'.repeat(48);
const enabledEnvironment = {
  APP_ENV: 'staging',
  STAGING_CONFIRM_ISOLATED: 'true',
  ALLOW_REMOTE_TESTS: 'true',
  STAGING_AUTOMATION_TOKEN: token,
};

test('staging automation is enabled only under explicit isolated staging gates', () => {
  assert.equal(stagingAutomationEnabled(enabledEnvironment), true);
  assert.equal(stagingAutomationEnabled({ ...enabledEnvironment, APP_ENV: 'production' }), false);
  assert.equal(stagingAutomationEnabled({ ...enabledEnvironment, STAGING_CONFIRM_ISOLATED: 'false' }), false);
  assert.equal(stagingAutomationEnabled({ ...enabledEnvironment, ALLOW_REMOTE_TESTS: 'false' }), false);
});

test('staging automation token rejects missing and incorrect bearer credentials', () => {
  const valid = new Request('https://staging.example.test/api/staging/provider-probe', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.doesNotThrow(() => assertStagingAutomationRequest(valid, enabledEnvironment));

  const wrong = new Request('https://staging.example.test/api/staging/provider-probe', {
    method: 'POST',
    headers: { authorization: `Bearer ${'b'.repeat(48)}` },
  });
  assert.throws(
    () => assertStagingAutomationRequest(wrong, enabledEnvironment),
    (error: unknown) => error instanceof StagingAutomationError && error.status === 401,
  );

  assert.throws(
    () => assertStagingAutomationRequest(valid, { ...enabledEnvironment, APP_ENV: 'production' }),
    (error: unknown) => error instanceof StagingAutomationError && error.status === 404,
  );
});

test('staging cleanup email allowlist accepts only generated acceptance identities', () => {
  for (const email of [
    'pcs-staging-a1b2c3d4@example.test',
    'pcs-chromium-a1b2c3d4@example.test',
    'pcs-firefox-a1b2c3d4@example.test',
    'pcs-webkit-a1b2c3d4@example.test',
  ]) assert.equal(isStagingTestEmail(email), true);

  for (const email of [
    'owner@example.test',
    'pcs-staging-admin@example.com',
    'pcs-browser-a1b2c3d4@example.test',
    'pcs-staging-../escape@example.test',
  ]) assert.equal(isStagingTestEmail(email), false);
});

test('GitHub staging workflow no longer receives provider or database credentials', () => {
  const workflow = repositoryFile('.github/workflows/staging-acceptance.yml');
  assert.match(workflow, /STAGING_AUTOMATION_TOKEN/);
  assert.match(workflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.doesNotMatch(workflow, /STAGING_DATABASE_URL/);
  assert.doesNotMatch(workflow, /STAGING_DATABASE_MIGRATION_URL/);
  assert.doesNotMatch(workflow, /STAGING_SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /STAGING_RATE_LIMIT_TOKEN/);
  assert.doesNotMatch(workflow, /STAGING_NEXTAUTH_SECRET/);
});

test('staging harnesses no longer import direct PostgreSQL or provider service credentials', () => {
  const browser = repositoryFile('verify-staging-browser.js');
  const acceptance = repositoryFile('verify-staging-acceptance.js');
  const cleanup = repositoryFile('scripts/cleanup-staging-acceptance.mjs');
  const providers = repositoryFile('scripts/verify-live-staging-providers.mjs');
  for (const source of [browser, acceptance, cleanup, providers]) {
    assert.doesNotMatch(source, /require\(['"]postgres['"]\)|from ['"]postgres['"]/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|RATE_LIMIT_TOKEN|DATABASE_MIGRATION_URL/);
  }
});

test('staging runner uses Vercel automation bypass headers instead of share-link query secrets', () => {
  const workflow = repositoryFile('.github/workflows/staging-acceptance.yml');
  const browser = repositoryFile('verify-staging-browser.js');
  const acceptance = repositoryFile('verify-staging-acceptance.js');
  const client = repositoryFile('scripts/lib/staging-automation-client.mjs');
  for (const source of [workflow, browser, acceptance, client]) {
    assert.match(source, /x-vercel-protection-bypass/);
    assert.doesNotMatch(source, /_vercel_share|VERCEL_SHARE_BYPASS_SECRET/);
  }
});

test('staging acceptance requires deployed isolation, migration, remote-test, and automation flags', () => {
  const workflow = repositoryFile('.github/workflows/staging-acceptance.yml');
  assert.match(workflow, /stagingIsolationConfirmed !== true/);
  assert.match(workflow, /remoteTestsEnabled !== true/);
  assert.match(workflow, /stagingMigrationsEnabled !== true/);
  assert.match(workflow, /stagingAutomationConfigured !== true/);
});

test('staging automation endpoints remain server-side and environment-gated', () => {
  const providerRoute = repositoryFile('src/app/api/staging/provider-probe/route.ts');
  const cleanupRoute = repositoryFile('src/app/api/staging/cleanup/route.ts');
  assert.match(providerRoute, /assertStagingAutomationRequest/);
  assert.match(providerRoute, /getStorageProvider/);
  assert.match(providerRoute, /getConfiguredRateLimiter/);
  assert.match(cleanupRoute, /assertStagingAutomationRequest/);
  assert.match(cleanupRoute, /isStagingTestEmail/);
  assert.match(cleanupRoute, /deleteAssetObject/);
});
