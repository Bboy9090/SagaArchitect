import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertAuthDeploymentUrl,
  authCookiePolicy,
  authEnvironmentName,
  authUsesSecureCookies,
  isProductionLikeAuthEnvironment,
} from '../src/lib/auth-security';
import { buildDeploymentIdentity } from '../src/lib/deployment-identity';

function repositoryFile(filePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

test('staging and preview Auth.js environments require secure cookies', () => {
  assert.equal(authEnvironmentName({ APP_ENV: 'staging' }), 'staging');
  assert.equal(isProductionLikeAuthEnvironment({ APP_ENV: 'staging' }), true);
  assert.equal(isProductionLikeAuthEnvironment({ VERCEL_ENV: 'preview' }), true);
  assert.equal(authUsesSecureCookies({ APP_ENV: 'production' }), true);
  assert.equal(authUsesSecureCookies({ APP_ENV: 'development' }), false);

  assert.deepEqual(authCookiePolicy({ APP_ENV: 'staging' }), {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
});

test('production-like Auth.js deployment URLs fail closed on missing, HTTP, and local hosts', () => {
  assert.throws(() => assertAuthDeploymentUrl({ APP_ENV: 'staging' }), /NEXTAUTH_URL is required/);
  assert.throws(
    () => assertAuthDeploymentUrl({ APP_ENV: 'staging', NEXTAUTH_URL: 'http://studio.example.test' }),
    /must use HTTPS/,
  );
  assert.throws(
    () => assertAuthDeploymentUrl({ VERCEL_ENV: 'preview', NEXTAUTH_URL: 'https://localhost:3000' }),
    /remote host/,
  );
  assert.doesNotThrow(() => assertAuthDeploymentUrl({
    APP_ENV: 'staging',
    NEXTAUTH_URL: 'https://staging.phoenix-creator.example',
  }));
  assert.doesNotThrow(() => assertAuthDeploymentUrl({ APP_ENV: 'development' }));
});

test('deployment identity exposes only safe evidence fields', () => {
  const identity = buildDeploymentIdentity({
    APP_ENV: 'staging',
    DEPLOYMENT_COMMIT_SHA: 'A'.repeat(40),
    ROLLBACK_COMMIT_SHA: 'b'.repeat(40),
    STORAGE_PROVIDER: 'supabase',
    RATE_LIMIT_PROVIDER: 'upstash',
    FEATURE_PROJECT_RESTORE: 'true',
    ENABLE_TEST_AUTH_BYPASS: 'true',
    DATABASE_URL: 'postgresql://should-not-appear',
    SUPABASE_SERVICE_ROLE_KEY: 'should-not-appear',
  });

  assert.deepEqual(identity, {
    environment: 'staging',
    commitSha: 'a'.repeat(40),
    rollbackCommitSha: 'b'.repeat(40),
    storageProvider: 'supabase',
    rateLimitProvider: 'upstash',
    projectRestoreEnabled: true,
    testAuthBypassEnabled: false,
  });
  assert.doesNotMatch(JSON.stringify(identity), /postgresql|service-role|should-not-appear/);
});

test('deployment identity rejects malformed commit and provider values', () => {
  const identity = buildDeploymentIdentity({
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_SHA: 'not-a-sha',
    ROLLBACK_COMMIT_SHA: 'also-invalid',
    STORAGE_PROVIDER: 'supabase;leak',
    RATE_LIMIT_PROVIDER: '',
  });

  assert.equal(identity.environment, 'staging');
  assert.equal(identity.commitSha, null);
  assert.equal(identity.rollbackCommitSha, null);
  assert.equal(identity.storageProvider, 'local');
  assert.equal(identity.rateLimitProvider, 'memory');
  assert.equal(identity.projectRestoreEnabled, false);
});

test('protected staging workflow executes the complete Playwright browser matrix', () => {
  const workflow = repositoryFile('.github/workflows/staging-acceptance.yml');
  assert.match(workflow, /PLAYWRIGHT_VERSION: "1\.62\.0"/);
  assert.match(workflow, /playwright install --with-deps chromium firefox webkit/);
  assert.match(workflow, /BROWSER_ENGINE: chromium/);
  assert.match(workflow, /BROWSER_ENGINE: firefox/);
  assert.match(workflow, /BROWSER_ENGINE: webkit/);
  assert.match(workflow, /steps\.chromium\.outcome/);
  assert.match(workflow, /steps\.firefox\.outcome/);
  assert.match(workflow, /steps\.webkit\.outcome/);
  assert.doesNotMatch(workflow, /PCS_FF_1440_VALIDATED|PCS_WK_1440_VALIDATED/);
});

test('staging browser verifier is engine-scoped, isolated, and evidence-producing', () => {
  const verifier = repositoryFile('verify-staging-browser.js');
  assert.match(verifier, /require\('playwright'\)/);
  assert.match(verifier, /PCS-CHR-1440/);
  assert.match(verifier, /PCS-FF-1440/);
  assert.match(verifier, /PCS-WK-1440/);
  assert.match(verifier, /production origin/);
  assert.match(verifier, /sessionCookiePolicy/);
  assert.match(verifier, /delete from users where email/);
});

test('staging receipt derives all browser classifications from artifact files', () => {
  const receipt = repositoryFile('scripts/generate-staging-receipt.mjs');
  assert.match(receipt, /PCS-CHR-1440\.json/);
  assert.match(receipt, /PCS-FF-1440\.json/);
  assert.match(receipt, /PCS-WK-1440\.json/);
  assert.match(receipt, /browserResults\.chromium/);
  assert.match(receipt, /browserResults\.firefox/);
  assert.match(receipt, /browserResults\.webkit/);
  assert.doesNotMatch(receipt, /PCS_FF_1440_VALIDATED|PCS_WK_1440_VALIDATED/);
});
