import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
    commitSha: commit,
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
    expectedCommit: commit,
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
    expectedCommit: commit,
    stagingReceipt: {
      decision: 'STAGING_PASS',
      commitSha: commit,
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
    expectedCommit: commit,
    stagingReceipt: {
      decision: 'STAGING_PASS',
      commitSha: commit,
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

test('Vercel Git policy blocks automatic main production deploys but keeps staging enabled', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git?.deploymentEnabled?.['*'], false);
  assert.equal(config.git?.deploymentEnabled?.main, false);
  assert.equal(config.git?.deploymentEnabled?.staging, true);
});

function candidateEvidence() {
  return {
    expectedCommit: commit,
    stagingReceipt: {
      decision: 'STAGING_PASS',
      commitSha: commit,
      classifications: {
        liveSupabaseValidated: true,
        liveUpstashValidated: true,
        browsers: Object.fromEntries(['chromium', 'firefox', 'webkit'].map((engine) => [engine, { emulatorValidated: true }])),
      },
    },
    hardwareAssessment: assessHardwareMatrix(HARDWARE_CLASSES.map(receipt), commit),
    securityEvidence: {
      credentialRotationConfirmed: true,
      historyReviewConfirmed: true,
      rollbackRehearsalConfirmed: true,
      oldCredentialRejected: true,
    },
  };
}

test('hardware receipts and complete matrices require an explicit full candidate commit', () => {
  for (const expectedCommit of [undefined, null, '', 'abc123', 'g'.repeat(40)]) {
    const validation = validateHardwareReceipt(receipt('android'), expectedCommit);
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /expected staging commit is required/);
    const matrix = assessHardwareMatrix(HARDWARE_CLASSES.map(receipt), expectedCommit);
    assert.equal(matrix.allRequiredPassed, false);
    assert.equal(matrix.expectedCommit, null);
  }
});

test('hardware matrices reject a stale device receipt even when every class reports PASS', () => {
  const receipts = HARDWARE_CLASSES.map(receipt);
  receipts.find((entry) => entry.hardwareClass === 'android').commitSha = 'b'.repeat(40);
  const matrix = assessHardwareMatrix(receipts, commit);
  assert.equal(matrix.allRequiredPassed, false);
  assert.equal(matrix.classes.android.hardwareValidated, false);
  assert.match(matrix.classes.android.errors.join('\n'), /does not match the staging commit/);
});

test('commit comparisons normalize hexadecimal case without weakening identity', () => {
  const receipts = HARDWARE_CLASSES.map((hardwareClass) => ({ ...receipt(hardwareClass), commitSha: commit.toUpperCase() }));
  const matrix = assessHardwareMatrix(receipts, commit.toUpperCase());
  assert.equal(matrix.allRequiredPassed, true);
  assert.equal(matrix.expectedCommit, commit);
  assert.equal(matrix.classes.android.commitSha, commit);
  const evidence = candidateEvidence();
  evidence.expectedCommit = commit.toUpperCase();
  evidence.stagingReceipt.commitSha = commit.toUpperCase();
  assert.equal(assessReleaseCandidate(evidence).eligible, true);
});

test('RC1 cannot infer candidate identity from otherwise passing evidence', () => {
  for (const expectedCommit of [undefined, null, '', 'abc123', 'g'.repeat(40)]) {
    const result = assessReleaseCandidate({ ...candidateEvidence(), expectedCommit });
    assert.equal(result.eligible, false);
    assert.match(result.blockers.join('\n'), /expected release commit is required/);
  }
});

test('RC1 rejects passing staging or hardware assessments from another commit', () => {
  const staleStaging = candidateEvidence();
  staleStaging.stagingReceipt.commitSha = 'b'.repeat(40);
  assert.match(assessReleaseCandidate(staleStaging).blockers.join('\n'), /Staging evidence does not match/);
  const staleHardware = candidateEvidence();
  staleHardware.hardwareAssessment.expectedCommit = 'b'.repeat(40);
  assert.match(assessReleaseCandidate(staleHardware).blockers.join('\n'), /Hardware matrix does not match/);
});

test('RC1 verifies every hardware class instead of trusting the summary pass flag', () => {
  const mutations = [
    (evidence) => { delete evidence.hardwareAssessment.classes.android; },
    (evidence) => { evidence.hardwareAssessment.classes.android.commitSha = 'b'.repeat(40); },
    (evidence) => { evidence.hardwareAssessment.classes.android.hardwareValidated = false; },
    (evidence) => { evidence.hardwareAssessment.classes.android.evidenceDigest = null; },
    (evidence) => { evidence.hardwareAssessment.classes.android.evidenceDigest = 'not-a-sha256'; },
  ];
  for (const mutate of mutations) {
    const evidence = candidateEvidence();
    mutate(evidence);
    assert.equal(evidence.hardwareAssessment.allRequiredPassed, true);
    const result = assessReleaseCandidate(evidence);
    assert.equal(result.eligible, false);
    assert.match(result.blockers.join('\n'), /android hardware evidence/);
  }
});

test('RC1 command writes blocked evidence without a candidate and rejects a mismatched candidate', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pcs-rc-source-test-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const evidence = candidateEvidence();
  for (const [filename, value] of [
    ['staging-evidence-receipt.json', evidence.stagingReceipt],
    ['hardware-matrix-assessment.json', evidence.hardwareAssessment],
    ['security-release-evidence.json', evidence.securityEvidence],
  ]) fs.writeFileSync(path.join(cwd, filename), JSON.stringify(value));

  const script = fileURLToPath(new URL('../scripts/generate-rc1-assessment.mjs', import.meta.url));
  const env = { ...process.env };
  for (const name of ['DEPLOYMENT_COMMIT_SHA', 'STAGING_RECEIPT', 'HARDWARE_ASSESSMENT', 'SECURITY_EVIDENCE']) delete env[name];
  const run = (candidate) => spawnSync(process.execPath, [script], {
    cwd,
    env: candidate === undefined ? env : { ...env, DEPLOYMENT_COMMIT_SHA: candidate },
    encoding: 'utf8',
    timeout: 10000,
  });
  const read = () => JSON.parse(fs.readFileSync(path.join(cwd, 'rc1-assessment.json'), 'utf8'));

  const missing = run();
  assert.ifError(missing.error);
  assert.equal(missing.status, 1, missing.stderr);
  assert.equal(read().commitSha, null);
  assert.equal(read().decision, 'RC1_BLOCKED');

  const wrong = run('b'.repeat(40));
  assert.ifError(wrong.error);
  assert.equal(wrong.status, 1, wrong.stderr);
  assert.equal(read().commitSha, 'b'.repeat(40));
  assert.equal(read().decision, 'RC1_BLOCKED');

  const correct = run(commit.toUpperCase());
  assert.ifError(correct.error);
  assert.equal(correct.status, 0, correct.stderr);
  assert.equal(read().commitSha, commit);
  assert.equal(read().decision, 'RC1_ELIGIBLE');
});
