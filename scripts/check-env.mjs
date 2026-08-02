const productionMode = process.argv.includes('--production');
const stagingMode = process.argv.includes('--staging');
const deploymentMode = process.argv.includes('--deployment') || productionMode || stagingMode;
const env = { ...process.env };
if (productionMode) env.APP_ENV = 'production';
if (stagingMode) env.APP_ENV = 'staging';

const issues = [];
const value = (key) => env[key]?.trim() || undefined;
const requireValue = (key) => {
  if (!value(key)) issues.push(`${key} is required.`);
};
const isUrl = (candidate, protocols) => {
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    return protocols.includes(parsed.protocol);
  } catch {
    return false;
  }
};
const isRemoteHttps = (candidate) => {
  if (!isUrl(candidate, ['https:'])) return false;
  const hostname = new URL(candidate).hostname.toLowerCase();
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
};
const commitSha = /^[0-9a-f]{40}$/i;

const appEnv = (value('APP_ENV') || value('VERCEL_ENV') || (value('NODE_ENV') === 'test' ? 'test' : 'development')).toLowerCase();
const productionLike = ['production', 'staging', 'preview'].includes(appEnv);
const storageProvider = value('STORAGE_PROVIDER') || 'local';
const rateLimitProvider = value('RATE_LIMIT_PROVIDER') || 'memory';
const testAuthBypassRequested = value('ENABLE_TEST_AUTH_BYPASS') === 'true';
const deploymentCommitSha = value('DEPLOYMENT_COMMIT_SHA') || value('VERCEL_GIT_COMMIT_SHA');
const rollbackCommitSha = value('ROLLBACK_COMMIT_SHA');

if (!['local', 'supabase', 's3'].includes(storageProvider)) issues.push('STORAGE_PROVIDER must be local, supabase, or s3.');
if (!['memory', 'redis', 'upstash'].includes(rateLimitProvider)) issues.push('RATE_LIMIT_PROVIDER must be memory, redis, or upstash.');
if (testAuthBypassRequested && appEnv !== 'test') issues.push('ENABLE_TEST_AUTH_BYPASS may only be enabled when APP_ENV=test.');

if (productionLike) {
  requireValue('DATABASE_URL');
  requireValue('NEXTAUTH_SECRET');
  requireValue('NEXTAUTH_URL');
  if ((value('NEXTAUTH_SECRET') || '').length < 32) issues.push('NEXTAUTH_SECRET must be at least 32 characters.');
  if (value('NEXTAUTH_URL') && !isRemoteHttps(value('NEXTAUTH_URL'))) issues.push('NEXTAUTH_URL must be a remote HTTPS URL.');
  if (storageProvider === 'local') issues.push('Local filesystem storage is forbidden in staging and production.');
  if (rateLimitProvider === 'memory') issues.push('Memory-only rate limiting is forbidden in staging and production.');

  if (storageProvider === 'supabase') {
    requireValue('SUPABASE_URL');
    requireValue('SUPABASE_SERVICE_ROLE_KEY');
    requireValue('SUPABASE_STORAGE_BUCKET');
    if (value('SUPABASE_URL') && !isRemoteHttps(value('SUPABASE_URL'))) issues.push('SUPABASE_URL must be a remote HTTPS URL.');
  }
  if (rateLimitProvider === 'redis' || rateLimitProvider === 'upstash') {
    requireValue('RATE_LIMIT_URL');
    requireValue('RATE_LIMIT_TOKEN');
    if (value('RATE_LIMIT_URL') && !isRemoteHttps(value('RATE_LIMIT_URL'))) issues.push('RATE_LIMIT_URL must be a remote HTTPS URL.');
  }
}

if (value('DATABASE_URL') && !isUrl(value('DATABASE_URL'), ['postgres:', 'postgresql:'])) {
  issues.push('DATABASE_URL must be a valid PostgreSQL URL.');
}
if (value('DATABASE_MIGRATION_URL') && !isUrl(value('DATABASE_MIGRATION_URL'), ['postgres:', 'postgresql:'])) {
  issues.push('DATABASE_MIGRATION_URL must be a valid PostgreSQL URL.');
}

if (deploymentMode) {
  requireValue('DATABASE_MIGRATION_URL');
  if (productionLike && value('DATABASE_URL') && value('DATABASE_URL') === value('DATABASE_MIGRATION_URL')) {
    issues.push('Runtime and migration database URLs must be separate in staging and production deployments.');
  }
}

if (appEnv === 'staging' && deploymentMode) {
  if (storageProvider !== 'supabase') issues.push('The approved staging architecture requires STORAGE_PROVIDER=supabase.');
  if (rateLimitProvider !== 'upstash') issues.push('The approved staging architecture requires RATE_LIMIT_PROVIDER=upstash.');
  if (!deploymentCommitSha || !commitSha.test(deploymentCommitSha)) issues.push('A full 40-character deployment commit SHA is required.');
  if (!rollbackCommitSha || !commitSha.test(rollbackCommitSha)) issues.push('A full 40-character rollback commit SHA is required.');
  if (value('STAGING_CONFIRM_ISOLATED') !== 'true') {
    issues.push('STAGING_CONFIRM_ISOLATED=true is required after confirming staging uses no production data or credentials.');
  }
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, environment: appEnv, issues }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  environment: appEnv,
  storageProvider,
  rateLimitProvider,
  testAuthBypassEnabled: testAuthBypassRequested,
  deploymentValidated: deploymentMode,
  deploymentCommitRecorded: Boolean(deploymentCommitSha),
  rollbackCommitRecorded: Boolean(rollbackCommitSha),
  stagingIsolationConfirmed: value('STAGING_CONFIRM_ISOLATED') === 'true',
}, null, 2));
