import fs from 'node:fs';
import { createHash } from 'node:crypto';

function readJson(path, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function booleanEnvironment(key) {
  return process.env[key]?.trim().toLowerCase() === 'true';
}

function hashFile(path) {
  try {
    return createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  } catch {
    return null;
  }
}

const deployment = readJson('deployment-identity.json');
const providers = readJson('live-provider-evidence.json');
const browser = readJson('artifacts/staging-browser/PCS-CHR-1440.json');
const acceptance = readJson('staging-acceptance-evidence.json');
const cleanup = readJson('staging-cleanup-evidence.json');
const runSummary = readJson('staging-run-summary.json', {
  repository: 'Bboy9090/SagaArchitect',
  rollbackCommitSha: process.env.ROLLBACK_COMMIT_SHA || null,
  stagingUrl: process.env.STAGING_BASE_URL || null,
  runId: process.env.GITHUB_RUN_ID || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
});

const expectedCommit = process.env.DEPLOYMENT_COMMIT_SHA?.toLowerCase() || null;
const stagingPassed = Boolean(
  deployment.ok
  && deployment.data?.environment === 'staging'
  && deployment.data?.commitSha === expectedCommit
  && deployment.data?.storageProvider === 'supabase'
  && deployment.data?.rateLimitProvider === 'upstash'
  && deployment.data?.projectRestoreEnabled === true
  && deployment.data?.testAuthBypassEnabled === false
  && providers.ok === true
  && providers.providers?.storage?.ok === true
  && providers.providers?.rateLimit?.ok === true
  && browser.ok === true
  && browser.configuration === 'PCS-CHR-1440'
  && acceptance.ok === true
  && acceptance.deployment?.commitSha === expectedCommit
  && acceptance.cleanup?.user === true
  && Number(acceptance.cleanup?.projects || 0) >= 2
  && Number(acceptance.cleanup?.assets || 0) >= 2
  && cleanup.ok === true
  && cleanup.remainingUsers === 0
);

const credentialRotationConfirmed = booleanEnvironment('CREDENTIAL_ROTATION_CONFIRMED');
const historyReviewConfirmed = booleanEnvironment('HISTORY_REVIEW_CONFIRMED');
const rollbackRehearsalConfirmed = booleanEnvironment('ROLLBACK_REHEARSAL_CONFIRMED');
const firefoxValidated = booleanEnvironment('PCS_FF_1440_VALIDATED');
const webkitValidated = booleanEnvironment('PCS_WK_1440_VALIDATED');
const releaseCandidateEligible = Boolean(
  stagingPassed
  && credentialRotationConfirmed
  && historyReviewConfirmed
  && rollbackRehearsalConfirmed
  && firefoxValidated
  && webkitValidated
);

const missingEvidence = [
  ['deploymentIdentity', deployment.ok !== undefined],
  ['liveProviders', providers.ok !== undefined],
  ['chromium', browser.ok !== undefined],
  ['acceptance', acceptance.ok !== undefined],
  ['cleanup', cleanup.ok !== undefined],
].filter(([, present]) => !present).map(([name]) => name);

const receipt = {
  format: 'phoenix-creator-studio.staging-evidence',
  version: 1,
  generatedAt: new Date().toISOString(),
  repository: runSummary.repository,
  commitSha: expectedCommit,
  rollbackCommitSha: runSummary.rollbackCommitSha,
  stagingUrl: runSummary.stagingUrl,
  workflow: {
    runId: runSummary.runId,
    runAttempt: runSummary.runAttempt,
  },
  classifications: {
    liveStagingAccepted: stagingPassed,
    liveSupabaseValidated: providers.providers?.storage?.ok === true,
    liveUpstashValidated: providers.providers?.rateLimit?.ok === true,
    chromium: {
      configuration: 'PCS-CHR-1440',
      emulatorValidated: browser.ok === true,
    },
    firefox: {
      configuration: 'PCS-FF-1440',
      emulatorValidated: firefoxValidated,
    },
    webkit: {
      configuration: 'PCS-WK-1440',
      emulatorValidated: webkitValidated,
    },
    hardwareValidated: false,
    releaseCandidateEligible,
  },
  securityGates: {
    credentialRotationConfirmed,
    historyReviewConfirmed,
    rollbackRehearsalConfirmed,
    testAuthBypassDisabled: deployment.data?.testAuthBypassEnabled === false,
  },
  recovery: {
    backupSha256: acceptance.backupSha256 || null,
    lifecycleReceiptId: acceptance.lifecycleReceiptId || null,
    restoredProjectId: acceptance.restoredProjectId || null,
    inRunCleanup: acceptance.cleanup || null,
    finalCleanup: cleanup.ok === undefined ? null : cleanup,
  },
  missingEvidence,
  evidenceDigests: {
    deploymentIdentity: hashFile('deployment-identity.json'),
    liveProviders: hashFile('live-provider-evidence.json'),
    chromium: hashFile('artifacts/staging-browser/PCS-CHR-1440.json'),
    acceptance: hashFile('staging-acceptance-evidence.json'),
    cleanup: hashFile('staging-cleanup-evidence.json'),
  },
  decision: stagingPassed ? 'STAGING_PASS' : 'STAGING_FAIL',
  releaseDecision: releaseCandidateEligible ? 'RC_ELIGIBLE' : 'RC_BLOCKED',
};

fs.writeFileSync('staging-evidence-receipt.json', `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(receipt, null, 2));

if (!stagingPassed) process.exitCode = 1;
