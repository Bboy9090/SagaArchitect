import {
  MINIMUM_PRODUCTION_SECRET_LENGTH,
  type AppEnvironment,
  type EnvironmentIssue,
  type EnvironmentValidationResult,
  type EnvironmentValidationTarget,
  type RateLimitProvider,
  type ServerEnvironment,
  type StorageProvider,
} from './env-schema';
import { ConfigurationError } from './api-errors';

const COMMIT_SHA = /^[0-9a-f]{40}$/i;

function valueOf(input: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = input[key]?.trim();
  return value ? value : undefined;
}

function appEnvironmentOf(input: NodeJS.ProcessEnv): AppEnvironment {
  const explicit = valueOf(input, 'APP_ENV') ?? valueOf(input, 'VERCEL_ENV');
  const candidate = (explicit ?? (valueOf(input, 'NODE_ENV') === 'test' ? 'test' : 'development')).toLowerCase();
  if (candidate === 'production' || candidate === 'staging' || candidate === 'test') return candidate;
  if (candidate === 'preview') return 'staging';
  return 'development';
}

function isValidUrl(value: string | undefined, protocols?: string[]): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return protocols ? protocols.includes(parsed.protocol) : true;
  } catch {
    return false;
  }
}

function isRemoteHttpsUrl(value: string | undefined): boolean {
  if (!isValidUrl(value, ['https:'])) return false;
  const hostname = new URL(value as string).hostname.toLowerCase();
  return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1';
}

function pushMissing(issues: EnvironmentIssue[], input: NodeJS.ProcessEnv, key: string): void {
  if (!valueOf(input, key)) issues.push({ key, message: `${key} is required.` });
}

export function validateServerEnvironment(
  input: NodeJS.ProcessEnv,
  target: EnvironmentValidationTarget = 'runtime',
): EnvironmentValidationResult {
  const issues: EnvironmentIssue[] = [];
  const appEnvironment = appEnvironmentOf(input);
  const productionLike = appEnvironment === 'production' || appEnvironment === 'staging';
  const testAuthBypassRequested = valueOf(input, 'ENABLE_TEST_AUTH_BYPASS') === 'true';
  const deploymentCommitSha = valueOf(input, 'DEPLOYMENT_COMMIT_SHA') ?? valueOf(input, 'VERCEL_GIT_COMMIT_SHA');
  const rollbackCommitSha = valueOf(input, 'ROLLBACK_COMMIT_SHA');
  const stagingConfirmedIsolated = valueOf(input, 'STAGING_CONFIRM_ISOLATED') === 'true';

  const storageProvider = (valueOf(input, 'STORAGE_PROVIDER') ?? 'local') as StorageProvider;
  const rateLimitProvider = (valueOf(input, 'RATE_LIMIT_PROVIDER') ?? 'memory') as RateLimitProvider;

  if (!['local', 'supabase', 's3'].includes(storageProvider)) {
    issues.push({ key: 'STORAGE_PROVIDER', message: 'STORAGE_PROVIDER must be local, supabase, or s3.' });
  }
  if (!['memory', 'redis', 'upstash'].includes(rateLimitProvider)) {
    issues.push({ key: 'RATE_LIMIT_PROVIDER', message: 'RATE_LIMIT_PROVIDER must be memory, redis, or upstash.' });
  }
  if (testAuthBypassRequested && appEnvironment !== 'test') {
    issues.push({
      key: 'ENABLE_TEST_AUTH_BYPASS',
      message: 'The test authentication bypass may only be enabled when APP_ENV=test.',
    });
  }

  if (productionLike) {
    pushMissing(issues, input, 'DATABASE_URL');
    pushMissing(issues, input, 'NEXTAUTH_SECRET');
    pushMissing(issues, input, 'NEXTAUTH_URL');

    const secret = valueOf(input, 'NEXTAUTH_SECRET');
    if (secret && secret.length < MINIMUM_PRODUCTION_SECRET_LENGTH) {
      issues.push({
        key: 'NEXTAUTH_SECRET',
        message: `NEXTAUTH_SECRET must be at least ${MINIMUM_PRODUCTION_SECRET_LENGTH} characters in staging and production.`,
      });
    }

    const authUrl = valueOf(input, 'NEXTAUTH_URL');
    if (authUrl && !isRemoteHttpsUrl(authUrl)) {
      issues.push({ key: 'NEXTAUTH_URL', message: 'NEXTAUTH_URL must be a remote HTTPS URL in staging and production.' });
    }

    if (storageProvider === 'local') {
      issues.push({ key: 'STORAGE_PROVIDER', message: 'Local filesystem storage is not allowed in staging or production.' });
    }
    if (rateLimitProvider === 'memory') {
      issues.push({ key: 'RATE_LIMIT_PROVIDER', message: 'Memory-only rate limiting is not allowed in staging or production.' });
    }

    if (storageProvider === 'supabase') {
      pushMissing(issues, input, 'SUPABASE_URL');
      pushMissing(issues, input, 'SUPABASE_SERVICE_ROLE_KEY');
      pushMissing(issues, input, 'SUPABASE_STORAGE_BUCKET');
      const supabaseUrl = valueOf(input, 'SUPABASE_URL');
      if (supabaseUrl && !isRemoteHttpsUrl(supabaseUrl)) {
        issues.push({ key: 'SUPABASE_URL', message: 'SUPABASE_URL must be a remote HTTPS URL.' });
      }
    }

    if (rateLimitProvider === 'redis' || rateLimitProvider === 'upstash') {
      pushMissing(issues, input, 'RATE_LIMIT_URL');
      pushMissing(issues, input, 'RATE_LIMIT_TOKEN');
      const rateLimitUrl = valueOf(input, 'RATE_LIMIT_URL');
      if (rateLimitUrl && !isRemoteHttpsUrl(rateLimitUrl)) {
        issues.push({ key: 'RATE_LIMIT_URL', message: 'RATE_LIMIT_URL must be a remote HTTPS URL.' });
      }
    }
  }

  const databaseUrl = valueOf(input, 'DATABASE_URL') ?? '';
  const databaseMigrationUrl = valueOf(input, 'DATABASE_MIGRATION_URL');
  if (databaseUrl && !isValidUrl(databaseUrl, ['postgres:', 'postgresql:'])) {
    issues.push({ key: 'DATABASE_URL', message: 'DATABASE_URL must be a valid PostgreSQL URL.' });
  }
  if (databaseMigrationUrl && !isValidUrl(databaseMigrationUrl, ['postgres:', 'postgresql:'])) {
    issues.push({ key: 'DATABASE_MIGRATION_URL', message: 'DATABASE_MIGRATION_URL must be a valid PostgreSQL URL.' });
  }

  if (target === 'deployment') {
    pushMissing(issues, input, 'DATABASE_MIGRATION_URL');
    if (databaseUrl && databaseMigrationUrl && databaseUrl === databaseMigrationUrl && productionLike) {
      issues.push({
        key: 'DATABASE_MIGRATION_URL',
        message: 'Runtime and migration database URLs must be separate in staging and production deployments.',
      });
    }

    if (appEnvironment === 'staging') {
      if (storageProvider !== 'supabase') {
        issues.push({ key: 'STORAGE_PROVIDER', message: 'The approved staging architecture requires Supabase Storage.' });
      }
      if (rateLimitProvider !== 'upstash') {
        issues.push({ key: 'RATE_LIMIT_PROVIDER', message: 'The approved staging architecture requires Upstash rate limiting.' });
      }
      if (!deploymentCommitSha || !COMMIT_SHA.test(deploymentCommitSha)) {
        issues.push({
          key: 'DEPLOYMENT_COMMIT_SHA',
          message: 'A full 40-character deployment commit SHA is required for staging evidence.',
        });
      }
      if (!rollbackCommitSha || !COMMIT_SHA.test(rollbackCommitSha)) {
        issues.push({
          key: 'ROLLBACK_COMMIT_SHA',
          message: 'A full 40-character rollback commit SHA is required for staging deployment.',
        });
      }
      if (!stagingConfirmedIsolated) {
        issues.push({
          key: 'STAGING_CONFIRM_ISOLATED',
          message: 'Set STAGING_CONFIRM_ISOLATED=true only after confirming staging uses no production data or credentials.',
        });
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const value: ServerEnvironment = {
    appEnvironment,
    nodeEnvironment: valueOf(input, 'NODE_ENV') ?? 'development',
    databaseUrl,
    databaseMigrationUrl,
    nextAuthSecret: valueOf(input, 'NEXTAUTH_SECRET') ?? 'phoenix-studio-local-development-secret-key-1234',
    nextAuthUrl: valueOf(input, 'NEXTAUTH_URL'),
    storageProvider,
    storagePath: valueOf(input, 'STORAGE_PATH') ?? 'storage/uploads',
    supabaseUrl: valueOf(input, 'SUPABASE_URL'),
    supabaseServiceRoleKey: valueOf(input, 'SUPABASE_SERVICE_ROLE_KEY'),
    supabaseStorageBucket: valueOf(input, 'SUPABASE_STORAGE_BUCKET'),
    rateLimitProvider,
    rateLimitUrl: valueOf(input, 'RATE_LIMIT_URL'),
    rateLimitToken: valueOf(input, 'RATE_LIMIT_TOKEN'),
    deploymentCommitSha,
    rollbackCommitSha,
    stagingConfirmedIsolated,
  };

  return { ok: true, issues: [], value };
}

export function assertServerEnvironment(
  input: NodeJS.ProcessEnv = process.env,
  target: EnvironmentValidationTarget = 'runtime',
): ServerEnvironment {
  const result = validateServerEnvironment(input, target);
  if (!result.ok || !result.value) {
    const summary = result.issues.map((issue) => `${issue.key}: ${issue.message}`).join('; ');
    throw new ConfigurationError(`Environment validation failed. ${summary}`);
  }
  return result.value;
}

export function getAuthSecret(input: NodeJS.ProcessEnv = process.env): string {
  return assertServerEnvironment(input, 'runtime').nextAuthSecret;
}
