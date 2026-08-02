import fs from 'node:fs';
import { createHash } from 'node:crypto';

function readJsonOptional(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function booleanEnvironment(key) {
  return process.env[key]?.trim().toLowerCase() === 'true';
}

function hashFileOptional(filePath) {
  try {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}

const deployment = readJsonOptional('deployment-identity.json');
const providers = readJsonOptional('live-provider-evidence.json');
const acceptance = readJsonOptional('staging-acceptance-evidence.json');
const cleanup = readJsonOptional('staging-cleanup-evidence.json');
const runSummary = readJsonOptional('staging-run-summary.json') ?? {};

const browserEvidence = {
  chromium: {
    configuration: 'PCS-CHR-1440',
    file: 'artifacts/staging-browser/PCS-CHR-1440.json',
    data: readJsonOptional('artifacts/staging-browser/PCS-CHR-1440.json'),
  },
  firefox: {
    configuration: 'PCS-FF-1440',
    file: 'artifacts/staging-browser/PCS-FF-1440.json',
    data: readJsonOptional('artifacts/staging-browser/PCS-FF-1440.json'),
  },
  webkit: {
    configuration: 'PCS-WK-1440',
    file: 'artifacts/staging-browser/PCS-WK-1440.json',
    data: readJsonOptional('artifacts/staging-browser/PCS-WK-1440.json'),
  },
};

function browserPassed(entry) {
  const evidence = entry.data;
  return Boolean(
    evidence
    && evidence.ok === true
    && evidence.configuration === entry.configuration
    && evidence.cleanup?.userDeleted === true
    && evidence.sessionCookiePolicy?.secure === true
    && evidence.sessionCookiePolicy?.httpOnly === true
    && evidence.sessionCookiePolicy?.sameSite === 'Lax'
    && Array.isArray(evidence.pageErrors)
    && evidence.pageErrors.length === 0
  );
}

const browserResults = Object.fromEntries(
  Object.entries(browserEvidence).map(([engine, entry]) => [engine, browserPassed(entry)]),
);

const expectedCommit = process.env.DEPLOYMENT_COMMIT_SHA?.toLowerCase() || null;
const stagingPassed = Boolean(
  expectedCommit
  && deployment?.ok === true
  && deployment.data?.environment === 'staging'
  && deployment.data?.commitSha === expectedCommit
  && deployment.data?.storageProvider === 'supabase'
  && deployment.data?.rateLimitProvider === 'upstash'
  && deployment.data?.projectRestoreEnabled === true
  && deployment.data?.testAuthBypassEnabled === false
  && providers?.ok === true
  && providers.providers?.storage?.ok === true
  && providers.providers?.rateLimit?.ok === true
  && browserResults.chromium
  && browserResults.firefox
  && browserResults.webkit
  && acceptance?.ok === true
  && acceptance.deployment?.commitSha === expectedCommit
  && acceptance.cleanup?.user === true
  && Number(acceptance.cleanup?.projects || 0) >= 2
  && Number(acceptance.cleanup?.assets || 0) >= 2
  && cleanup?.ok === true
  && cleanup.remainingUsers === 0
);

const credentialRotationConfirmed = booleanEnvironment('CREDENTIAL_ROTATION_CONFIRMED');
const historyReviewConfirmed = booleanEnvironment('HISTORY_REVIEW_CONFIRMED');
const rollbackRehearsalConfirmed = booleanEnvironment('ROLLBACK_REHEARSAL_CONFIRMED');
const releaseCandidateEligible = Boolean(
  stagingPassed
  && credentialRotationConfirmed
  && historyReviewConfirmed
  && rollbackRehearsalConfirmed
);

const browserClassifications = Object.fromEntries(
  Object.entries(browserEvidence).map(([engine, entry]) => [engine, {
    configuration: entry.configuration,
    emulatorValidated: browserResults[engine],
    browserVersion: entry.data?.browserVersion ?? null,
    evidenceFile: entry.data ? entry.file : null,
  }]),
);

const missingEvidence = [
  ['deploymentIdentity', Boolean(deployment)],
  ['liveProviders', Boolean(providers)],
  ['chromium', Boolean(browserEvidence.chromium.data)],
  ['firefox', Boolean(browserEvidence.firefox.data)],
  ['webkit', Boolean(browserEvidence.webkit.data)],
  ['acceptance', Boolean(acceptance)],
  ['cleanup', Boolean(cleanup)],
].filter(([, present]) => !present).map(([name]) => name);

const receipt = {
  format: 'phoenix-creator-studio.staging-evidence',
  version: 2,
  generatedAt: new Date().toISOString(),
  repository: runSummary.repository ?? 'Bboy9090/SagaArchitect',
  commitSha: expectedCommit,
  rollbackCommitSha: runSummary.rollbackCommitSha ?? process.env.ROLLBACK_COMMIT_SHA ?? null,
  stagingUrl: runSummary.stagingUrl ?? process.env.STAGING_BASE_URL ?? null,
  playwrightVersion: runSummary.playwrightVersion ?? process.env.PLAYWRIGHT_VERSION ?? null,
  workflow: {
    runId: runSummary.runId ?? process.env.GITHUB_RUN_ID ?? null,
    runAttempt: runSummary.runAttempt ?? process.env.GITHUB_RUN_ATTEMPT ?? null,
  },
  classifications: {
    liveStagingAccepted: stagingPassed,
    liveSupabaseValidated: providers?.providers?.storage?.ok === true,
    liveUpstashValidated: providers?.providers?.rateLimit?.ok === true,
    browsers: browserClassifications,
    hardwareValidated: false,
    releaseCandidateEligible,
  },
  securityGates: {
    credentialRotationConfirmed,
    historyReviewConfirmed,
    rollbackRehearsalConfirmed,
    testAuthBypassDisabled: deployment?.data?.testAuthBypassEnabled === false,
  },
  recovery: {
    backupSha256: acceptance?.backupSha256 ?? null,
    lifecycleReceiptId: acceptance?.lifecycleReceiptId ?? null,
    restoredProjectId: acceptance?.restoredProjectId ?? null,
    inRunCleanup: acceptance?.cleanup ?? null,
    finalCleanup: cleanup,
  },
  missingEvidence,
  evidenceDigests: {
    deploymentIdentity: hashFileOptional('deployment-identity.json'),
    liveProviders: hashFileOptional('live-provider-evidence.json'),
    chromium: hashFileOptional(browserEvidence.chromium.file),
    firefox: hashFileOptional(browserEvidence.firefox.file),
    webkit: hashFileOptional(browserEvidence.webkit.file),
    acceptance: hashFileOptional('staging-acceptance-evidence.json'),
    cleanup: hashFileOptional('staging-cleanup-evidence.json'),
  },
  decision: stagingPassed ? 'STAGING_PASS' : 'STAGING_FAIL',
  releaseDecision: releaseCandidateEligible ? 'RC_ELIGIBLE' : 'RC_BLOCKED',
};

fs.writeFileSync('staging-evidence-receipt.json', `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(receipt, null, 2));

if (!stagingPassed) process.exitCode = 1;
