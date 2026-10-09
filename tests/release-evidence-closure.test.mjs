import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHistoryAuditReport,
  scanTextForSecretFingerprints,
} from '../scripts/lib/history-secret-audit.mjs';
import {
  buildHardwarePreflight,
  physicalArchitecture,
  suggestedHardwareClass,
} from '../scripts/lib/hardware-preflight.mjs';
import { validateHardwareReceipt } from '../scripts/lib/release-evidence.mjs';

test('history scanner fingerprints credential-like values without returning the raw value', () => {
  const secret = 'postgresql://appuser:very-real-password-123@example.db.internal:5432/app';
  const findings = scanTextForSecretFingerprints(`DATABASE_URL=${secret}`);
  assert.equal(findings.length >= 1, true);
  const serialized = JSON.stringify(findings);
  assert.doesNotMatch(serialized, /very-real-password-123/);
  assert.match(serialized, /postgres-url-with-password/);
  assert.match(serialized, /[0-9a-f]{64}/);
});

test('history audit distinguishes current-tree findings from historical-only findings', () => {
  const objects = [
    {
      sha: 'a'.repeat(40),
      path: 'scripts/old-check.mjs',
      findings: [{ category: 'assigned-secret-value', fingerprint: '1'.repeat(64) }],
    },
    {
      sha: 'b'.repeat(40),
      path: '.env.example',
      findings: [{ category: 'jwt-like-token', fingerprint: '2'.repeat(64) }],
    },
  ];
  const currentTree = new Set([`${'b'.repeat(40)}\0.env.example`]);
  const report = buildHistoryAuditReport({
    objects,
    currentTree,
    generatedAt: '2026-10-09T20:00:00.000Z',
  });
  assert.equal(report.findingCount, 2);
  assert.equal(report.currentTreeFindings, 1);
  assert.equal(report.historicalOnlyFindings, 1);
  assert.equal(report.currentTreeClean, false);
  assert.equal(report.historyClean, false);
  assert.equal(report.secretValuesIncluded, false);
});

test('placeholder examples are ignored by the history scanner', () => {
  const findings = scanTextForSecretFingerprints(
    'DATABASE_URL=postgresql://user:your-password@example.com/db\nAPI_KEY=changeme-placeholder',
  );
  assert.deepEqual(findings, []);
});

test('hardware preflight detects physical Apple Silicon even under an x64 translated Node runtime', () => {
  assert.equal(physicalArchitecture('darwin', 'x64', true), 'arm64');
  assert.equal(physicalArchitecture('darwin', 'arm64', true), 'arm64');
  assert.equal(physicalArchitecture('darwin', 'x64', false), 'x64');
  assert.equal(physicalArchitecture('win32', 'x64', false), 'x64');
});

test('hardware preflight identifies Apple Silicon and Windows desktop classes only', () => {
  assert.equal(suggestedHardwareClass('darwin', 'arm64'), 'macos-apple-silicon');
  assert.equal(suggestedHardwareClass('darwin', 'x64'), null);
  assert.equal(suggestedHardwareClass('win32', 'x64'), 'windows-desktop');
  assert.equal(suggestedHardwareClass('linux', 'x64'), null);
});

test('complete physical preflight remains explicitly non-validating', () => {
  const commit = 'a'.repeat(40);
  const preflight = buildHardwarePreflight({
    platform: 'darwin',
    arch: 'arm64',
    hostname: 'physical-mac',
    manufacturer: 'Apple',
    model: 'MacBook Pro',
    osName: 'macOS',
    osVersion: '15.7',
    osBuild: '24G222',
    browser: { name: 'Google Chrome', version: '154.0.0.0' },
    commitSha: commit,
    stagingUrl: 'https://staging.example.test',
    collectedAt: '2026-10-09T20:00:00.000Z',
  });
  assert.equal(preflight.eligibleForPhysicalValidation, true);
  assert.equal(preflight.hardwareValidated, false);
  assert.equal(preflight.classification, 'preflight-only');

  const validation = validateHardwareReceipt(preflight, commit);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /Unsupported hardware receipt format|result must be PASS|Cleanup/);
});

test('preflight fails readiness without exact commit or HTTPS staging URL', () => {
  const preflight = buildHardwarePreflight({
    platform: 'win32',
    arch: 'x64',
    hostname: 'pc',
    manufacturer: 'Example',
    model: 'Workstation',
    osName: 'Windows',
    osVersion: '11',
    osBuild: '26100',
    browser: { name: 'Edge', version: '154.0.0.0' },
    commitSha: 'short',
    stagingUrl: 'http://localhost:3000',
  });
  assert.equal(preflight.eligibleForPhysicalValidation, false);
  assert.equal(preflight.readiness.exactCommitProvided, false);
  assert.equal(preflight.readiness.httpsStagingUrlProvided, false);
});
