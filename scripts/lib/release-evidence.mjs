import { createHash } from 'node:crypto';

export const HARDWARE_CLASSES = [
  'windows-desktop',
  'macos-apple-silicon',
  'ios-ipados',
  'android',
  'chromeos',
];

const SHA40 = /^[0-9a-f]{40}$/i;

export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function validateHardwareReceipt(receipt, expectedCommit) {
  const errors = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { valid: false, errors: ['Receipt must be an object.'] };
  }
  if (receipt.format !== 'phoenix-creator-studio.hardware-evidence') errors.push('Unsupported hardware receipt format.');
  if (receipt.version !== 1) errors.push('Unsupported hardware receipt version.');
  if (!HARDWARE_CLASSES.includes(receipt.hardwareClass)) errors.push('Unknown hardware class.');
  if (!receipt.device || typeof receipt.device !== 'object') errors.push('Identified physical device is required.');
  if (!receipt.device?.manufacturer || !receipt.device?.model) errors.push('Device manufacturer and model are required.');
  if (!receipt.os?.name || !receipt.os?.version) errors.push('OS name and version are required.');
  if (!receipt.browser?.name || !receipt.browser?.version) errors.push('Browser name and version are required.');
  if (!SHA40.test(receipt.commitSha || '')) errors.push('A full 40-character commit SHA is required.');
  if (expectedCommit && receipt.commitSha?.toLowerCase() !== expectedCommit.toLowerCase()) errors.push('Receipt commit does not match the staging commit.');
  try {
    const url = new URL(receipt.stagingUrl);
    if (url.protocol !== 'https:') errors.push('Staging URL must use HTTPS.');
  } catch {
    errors.push('A valid staging URL is required.');
  }
  if (receipt.result !== 'PASS') errors.push('Hardware receipt result must be PASS.');
  if (receipt.cleanup?.ok !== true) errors.push('Cleanup must be confirmed.');
  if (!receipt.operator || typeof receipt.operator !== 'string') errors.push('Operator identifier is required.');
  if (!receipt.completedAt || Number.isNaN(Date.parse(receipt.completedAt))) errors.push('A valid completion timestamp is required.');
  if (!Array.isArray(receipt.assertions) || receipt.assertions.length === 0) errors.push('At least one hardware assertion is required.');
  if (receipt.secretValuesPresent === true) errors.push('Hardware receipts must not contain secret values.');
  return { valid: errors.length === 0, errors };
}

export function assessHardwareMatrix(receipts, expectedCommit) {
  const byClass = {};
  for (const hardwareClass of HARDWARE_CLASSES) {
    const candidates = receipts.filter((receipt) => receipt?.hardwareClass === hardwareClass);
    const evaluated = candidates.map((receipt) => ({ receipt, validation: validateHardwareReceipt(receipt, expectedCommit) }));
    const passing = evaluated.find((entry) => entry.validation.valid);
    byClass[hardwareClass] = {
      hardwareValidated: Boolean(passing),
      device: passing ? `${passing.receipt.device.manufacturer} ${passing.receipt.device.model}` : null,
      os: passing ? `${passing.receipt.os.name} ${passing.receipt.os.version}` : null,
      browser: passing ? `${passing.receipt.browser.name} ${passing.receipt.browser.version}` : null,
      completedAt: passing?.receipt.completedAt ?? null,
      errors: passing ? [] : evaluated.flatMap((entry) => entry.validation.errors),
    };
  }
  const allRequiredPassed = HARDWARE_CLASSES.every((hardwareClass) => byClass[hardwareClass].hardwareValidated);
  return { allRequiredPassed, classes: byClass };
}

export function assessReleaseCandidate({ stagingReceipt, hardwareAssessment, securityEvidence }) {
  const blockers = [];
  if (stagingReceipt?.decision !== 'STAGING_PASS') blockers.push('Live staging acceptance has not passed.');
  if (stagingReceipt?.classifications?.liveSupabaseValidated !== true) blockers.push('Live Supabase validation is missing.');
  if (stagingReceipt?.classifications?.liveUpstashValidated !== true) blockers.push('Live Upstash validation is missing.');
  const browsers = stagingReceipt?.classifications?.browsers ?? {};
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    if (browsers?.[engine]?.emulatorValidated !== true) blockers.push(`${engine} browser validation is missing.`);
  }
  if (hardwareAssessment?.allRequiredPassed !== true) blockers.push('Required physical hardware matrix has not passed.');
  if (securityEvidence?.credentialRotationConfirmed !== true) blockers.push('Credential rotation/revocation is not confirmed.');
  if (securityEvidence?.historyReviewConfirmed !== true) blockers.push('Git-history and retained-artifact review is not confirmed.');
  if (securityEvidence?.rollbackRehearsalConfirmed !== true) blockers.push('Rollback rehearsal is not confirmed.');
  if (securityEvidence?.oldCredentialRejected !== true) blockers.push('Old credential rejection has not been verified.');
  return {
    eligible: blockers.length === 0,
    decision: blockers.length === 0 ? 'RC1_ELIGIBLE' : 'RC1_BLOCKED',
    blockers,
  };
}
