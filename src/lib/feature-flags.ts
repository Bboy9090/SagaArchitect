import { ConfigurationError, FeatureDisabledError } from './api-errors';

export type FeatureName =
  | 'projectCreation'
  | 'projectDeletion'
  | 'migrationImport'
  | 'assetUpload'
  | 'pdfExport'
  | 'historyRestore'
  | 'canonScan'
  | 'accountExport'
  | 'accountDeletion';

const DEFAULTS: Record<FeatureName, boolean> = {
  projectCreation: true,
  projectDeletion: true,
  migrationImport: true,
  assetUpload: true,
  pdfExport: true,
  historyRestore: true,
  canonScan: true,
  accountExport: true,
  accountDeletion: false,
};

const ENV_KEYS: Record<FeatureName, string> = {
  projectCreation: 'FEATURE_PROJECT_CREATION',
  projectDeletion: 'FEATURE_PROJECT_DELETION',
  migrationImport: 'FEATURE_MIGRATION_IMPORT',
  assetUpload: 'FEATURE_ASSET_UPLOAD',
  pdfExport: 'FEATURE_PDF_EXPORT',
  historyRestore: 'FEATURE_HISTORY_RESTORE',
  canonScan: 'FEATURE_CANON_SCAN',
  accountExport: 'FEATURE_ACCOUNT_EXPORT',
  accountDeletion: 'FEATURE_ACCOUNT_DELETION',
};

function parseFlag(value: string | undefined, defaultValue: boolean, key: string): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'enabled', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'disabled', 'off'].includes(normalized)) return false;
  throw new ConfigurationError(`${key} must be enabled/disabled, true/false, on/off, or 1/0.`);
}

export function isFeatureEnabled(
  feature: FeatureName,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  const key = ENV_KEYS[feature];
  return parseFlag(environment[key], DEFAULTS[feature], key);
}

export function assertFeatureEnabled(
  feature: FeatureName,
  environment: Record<string, string | undefined> = process.env,
): void {
  if (!isFeatureEnabled(feature, environment)) {
    throw new FeatureDisabledError(feature);
  }
}

export function resolvedFeatureFlags(
  environment: Record<string, string | undefined> = process.env,
): Readonly<Record<FeatureName, boolean>> {
  return Object.freeze(
    Object.fromEntries(
      (Object.keys(DEFAULTS) as FeatureName[]).map((feature) => [feature, isFeatureEnabled(feature, environment)]),
    ) as Record<FeatureName, boolean>,
  );
}
