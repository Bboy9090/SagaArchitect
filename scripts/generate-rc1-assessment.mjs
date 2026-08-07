import fs from 'node:fs';
import { assessReleaseCandidate, sha256Json } from './lib/release-evidence.mjs';

function readJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const stagingReceipt = readJson(process.env.STAGING_RECEIPT || 'staging-evidence-receipt.json');
const hardwareAssessment = readJson(process.env.HARDWARE_ASSESSMENT || 'hardware-matrix-assessment.json');
const securityEvidence = readJson(process.env.SECURITY_EVIDENCE || 'security-release-evidence.json') ?? {};

const assessment = assessReleaseCandidate({ stagingReceipt, hardwareAssessment, securityEvidence });
const receipt = {
  format: 'phoenix-creator-studio.rc1-assessment',
  version: 1,
  generatedAt: new Date().toISOString(),
  repository: 'Bboy9090/SagaArchitect',
  commitSha: stagingReceipt?.commitSha ?? process.env.DEPLOYMENT_COMMIT_SHA ?? null,
  stagingDecision: stagingReceipt?.decision ?? null,
  hardwarePassed: hardwareAssessment?.allRequiredPassed === true,
  securityEvidence: {
    credentialRotationConfirmed: securityEvidence.credentialRotationConfirmed === true,
    historyReviewConfirmed: securityEvidence.historyReviewConfirmed === true,
    rollbackRehearsalConfirmed: securityEvidence.rollbackRehearsalConfirmed === true,
    oldCredentialRejected: securityEvidence.oldCredentialRejected === true,
  },
  ...assessment,
};
receipt.evidenceDigest = sha256Json({
  stagingReceipt,
  hardwareAssessment,
  securityEvidence: receipt.securityEvidence,
});

fs.writeFileSync('rc1-assessment.json', `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.eligible) process.exitCode = 1;
