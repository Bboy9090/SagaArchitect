import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HARDWARE_CLASSES,
  assessHardwareMatrix,
  assessReleaseCandidate,
  sha256Json,
  validateHardwareReceipt,
} from '../scripts/lib/release-evidence.mjs';

const commit = 'a'.repeat(40);

function receipt(hardwareClass) {
  return {
    format: 'phoenix-creator-studio.hardware-evidence',
    version: 1,
    hardwareClass,
    device: { manufacturer: 'Test Maker', model: `Model ${hardwareClass}` },
    os: { name: 'Test OS', version: '1.0' },
    browser: { name: 'Test Browser', version: '100' },
    commitSha: commit,
    stagingUrl: 'https://staging.example.test',
    result: 'PASS',
    cleanup: { ok: true },
    operator: 'hardware-lab',
    completedAt: '2026-08-07T22:00:00.000Z',
    assertions: ['login', 'project reopen', 'asset retrieval'],
    secretValuesPresent: false,
  };
}

test('valid hardware receipt requires physical identity, exact commit, cleanup, and pass result', () => {
  const result = validateHardwareReceipt(receipt('windows-desktop'), commit);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('tampered or incomplete hardware evidence is rejected', () => {
  const candidate = receipt('android');
  candidate.commitSha = 'b'.repeat(40);
  candidate.cleanup.ok = false;
  candidate.secretValuesPresent = true;
  const result = validateHardwareReceipt(candidate, commit);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /does not match the staging commit/);
  assert.match(result.errors.join('\n'), /Cleanup must be confirmed/);
  assert.match(result.errors.join('\n'), /must not contain secret values/);
});

test('hardware evidence rejects sensitive fields even when the declaration says no secrets are present', () => {
  const candidate = receipt('android');
  candidate.notes = { apiKey: 'placeholder-that-must-never-be-recorded' };
  const result = validateHardwareReceipt(candidate, commit);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /sensitive credential fields/);
});

test('evidence digests are canonical across object key order', () => {
  assert.equal(
    sha256Json({ b: 2, a: { z: 3, y: 4 } }),
    sha256Json({ a: { y: 4, z: 3 }, b: 2 }),
  );
});

test('hardware matrix passes only when every required physical class has a valid receipt', () => {
  const partial = assessHardwareMatrix([receipt('windows-desktop')], commit);
  assert.equal(partial.allRequiredPassed, false);
  const full = assessHardwareMatrix(HARDWARE_CLASSES.map(receipt), commit);
  assert.equal(full.allRequiredPassed, true);
  for (const hardwareClass of HARDWARE_CLASSES) {
    assert.equal(full.classes[hardwareClass].hardwareValidated, true);
    assert.match(full.classes[hardwareClass].evidenceDigest, /^[0-9a-f]{64}$/);
  }
});

test('RC1 remains blocked when any live or security gate is missing', () => {
  const stagingReceipt = {
    decision: 'STAGING_PASS',
    classifications: {
      liveSupabaseValidated: true,
      liveUpstashValidated: true,
      browsers: {
        chromium: { emulatorValidated: true },
        firefox: { emulatorValidated: true },
        webkit: { emulatorValidated: true },
      },
    },
  };
  const hardwareAssessment = assessHardwareMatrix(HARDWARE_CLASSES.map(receipt), commit);
  const blocked = assessReleaseCandidate({
    stagingReceipt,
    hardwareAssessment,
    securityEvidence: {
      credentialRotationConfirmed: true,
      historyReviewConfirmed: true,
      rollbackRehearsalConfirmed: true,
      oldCredentialRejected: false,
    },
  });
  assert.equal(blocked.eligible, false);
  assert.match(blocked.blockers.join('\n'), /Old credential rejection/);
});

test('RC1 rejects security evidence that accidentally contains credential material', () => {
  const result = assessReleaseCandidate({
    stagingReceipt: {
      decision: 'STAGING_PASS',
      classifications: {
        liveSupabaseValidated: true,
        liveUpstashValidated: true,
        browsers: {
          chromium: { emulatorValidated: true },
          firefox: { emulatorValidated: true },
          webkit: { emulatorValidated: true },
        },
      },
    },
    hardwareAssessment: assessHardwareMatrix(HARDWARE_CLASSES.map(receipt), commit),
    securityEvidence: {
      credentialRotationConfirmed: true,
      historyReviewConfirmed: true,
      rollbackRehearsalConfirmed: true,
      oldCredentialRejected: true,
      token: 'should-never-be-recorded',
    },
  });
  assert.equal(result.eligible, false);
  assert.match(result.blockers.join('\n'), /sensitive credential material/);
});

test('RC1 becomes eligible only when staging, browsers, hardware, rollback, and security all pass', () => {
  const result = assessReleaseCandidate({
    stagingReceipt: {
      decision: 'STAGING_PASS',
      classifications: {
        liveSupabaseValidated: true,
        liveUpstashValidated: true,
        browsers: {
          chromium: { emulatorValidated: true },
          firefox: { emulatorValidated: true },
          webkit: { emulatorValidated: true },
        },
      },
    },
    hardwareAssessment: assessHardwareMatrix(HARDWARE_CLASSES.map(receipt), commit),
    securityEvidence: {
      credentialRotationConfirmed: true,
      historyReviewConfirmed: true,
      rollbackRehearsalConfirmed: true,
      oldCredentialRejected: true,
    },
  });
  assert.equal(result.eligible, true);
  assert.equal(result.decision, 'RC1_ELIGIBLE');
  assert.deepEqual(result.blockers, []);
});
