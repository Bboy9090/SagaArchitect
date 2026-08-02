import type { RateLimitPolicy } from './types';

export const RATE_LIMIT_POLICIES = {
  registration: { name: 'registration', limit: 5, windowMs: 15 * 60 * 1000 },
  login: { name: 'login', limit: 10, windowMs: 15 * 60 * 1000 },
  migrationPreview: { name: 'migration-preview', limit: 20, windowMs: 60 * 60 * 1000 },
  migrationImport: { name: 'migration-import', limit: 5, windowMs: 60 * 60 * 1000 },
  assetUpload: { name: 'asset-upload', limit: 60, windowMs: 60 * 60 * 1000 },
  export: { name: 'export', limit: 30, windowMs: 60 * 60 * 1000 },
  backup: { name: 'backup', limit: 10, windowMs: 60 * 60 * 1000 },
  restorePreflight: { name: 'restore-preflight', limit: 20, windowMs: 60 * 60 * 1000 },
  restore: { name: 'restore', limit: 5, windowMs: 60 * 60 * 1000 },
  canonScan: { name: 'canon-scan', limit: 30, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
