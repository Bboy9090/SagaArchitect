import { isFeatureEnabled } from './feature-flags';

const COMMIT_SHA = /^[0-9a-f]{40}$/i;

export interface DeploymentIdentity {
  environment: string;
  commitSha: string | null;
  rollbackCommitSha: string | null;
  storageProvider: string;
  rateLimitProvider: string;
  databaseSchema: string | null;
  rateLimitNamespace: string | null;
  projectRestoreEnabled: boolean;
  testAuthBypassEnabled: boolean;
  stagingIsolationConfirmed: boolean;
  remoteTestsEnabled: boolean;
  stagingMigrationsEnabled: boolean;
  stagingAutomationConfigured: boolean;
}

function safeProvider(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z0-9-]{1,32}$/.test(normalized) ? normalized : fallback;
}


function safeNamespace(value: string | undefined, pattern: RegExp): string | null {
  const normalized = value?.trim();
  return normalized && pattern.test(normalized) ? normalized : null;
}

function safeCommit(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && COMMIT_SHA.test(normalized) ? normalized.toLowerCase() : null;
}

export function buildDeploymentIdentity(
  environment: Record<string, string | undefined> = process.env,
): DeploymentIdentity {
  const appEnvironment = (
    environment.APP_ENV
    || environment.VERCEL_ENV
    || environment.NODE_ENV
    || 'development'
  ).trim().toLowerCase();

  return {
    environment: appEnvironment === 'preview' ? 'staging' : appEnvironment,
    commitSha: safeCommit(environment.DEPLOYMENT_COMMIT_SHA || environment.VERCEL_GIT_COMMIT_SHA),
    rollbackCommitSha: safeCommit(environment.ROLLBACK_COMMIT_SHA),
    storageProvider: safeProvider(environment.STORAGE_PROVIDER, 'local'),
    rateLimitProvider: safeProvider(environment.RATE_LIMIT_PROVIDER, 'memory'),
    databaseSchema: safeNamespace(environment.DATABASE_SCHEMA?.toLowerCase(), /^[a-z][a-z0-9_]{2,62}$/),
    rateLimitNamespace: safeNamespace(environment.RATE_LIMIT_NAMESPACE, /^[A-Za-z0-9][A-Za-z0-9:_-]{2,95}$/),
    projectRestoreEnabled: isFeatureEnabled('projectRestore', environment),
    testAuthBypassEnabled:
      environment.APP_ENV === 'test'
      && environment.ENABLE_TEST_AUTH_BYPASS === 'true',
    stagingIsolationConfirmed: environment.STAGING_CONFIRM_ISOLATED === 'true',
    remoteTestsEnabled: environment.ALLOW_REMOTE_TESTS === 'true',
    stagingMigrationsEnabled: environment.RUN_STAGING_MIGRATIONS === 'true',
    stagingAutomationConfigured: Boolean(
      environment.STAGING_AUTOMATION_TOKEN
      && environment.STAGING_AUTOMATION_TOKEN.trim().length >= 32
    ),
  };
}
