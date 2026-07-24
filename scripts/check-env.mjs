const productionMode = process.argv.includes('--production');
const deploymentMode = process.argv.includes('--deployment') || productionMode;
const env = { ...process.env };
if (productionMode) env.APP_ENV = 'production';

const issues = [];
const value = (key) => env[key]?.trim() || undefined;
const requireValue = (key) => {
  if (!value(key)) issues.push(`${key} is required.`);
};

const appEnv = (value('APP_ENV') || value('VERCEL_ENV') || (value('NODE_ENV') === 'test' ? 'test' : 'development')).toLowerCase();
const productionLike = appEnv === 'production' || appEnv === 'staging' || appEnv === 'preview';
const storageProvider = value('STORAGE_PROVIDER') || 'local';
const rateLimitProvider = value('RATE_LIMIT_PROVIDER') || 'memory';

if (!['local', 'supabase', 's3'].includes(storageProvider)) issues.push('STORAGE_PROVIDER must be local, supabase, or s3.');
if (!['memory', 'redis', 'upstash'].includes(rateLimitProvider)) issues.push('RATE_LIMIT_PROVIDER must be memory, redis, or upstash.');

if (productionLike) {
  requireValue('DATABASE_URL');
  requireValue('NEXTAUTH_SECRET');
  requireValue('NEXTAUTH_URL');
  if ((value('NEXTAUTH_SECRET') || '').length < 32) issues.push('NEXTAUTH_SECRET must be at least 32 characters.');
  if (storageProvider === 'local') issues.push('Local filesystem storage is forbidden in staging and production.');
  if (rateLimitProvider === 'memory') issues.push('Memory-only rate limiting is forbidden in staging and production.');

  if (storageProvider === 'supabase') {
    requireValue('SUPABASE_URL');
    requireValue('SUPABASE_SERVICE_ROLE_KEY');
    requireValue('SUPABASE_STORAGE_BUCKET');
  }
  if (rateLimitProvider === 'redis' || rateLimitProvider === 'upstash') {
    requireValue('RATE_LIMIT_URL');
    requireValue('RATE_LIMIT_TOKEN');
  }
}

if (deploymentMode) requireValue('DATABASE_MIGRATION_URL');

if (issues.length) {
  console.error(JSON.stringify({ ok: false, environment: appEnv, issues }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  environment: appEnv,
  storageProvider,
  rateLimitProvider,
  deploymentValidated: deploymentMode,
}, null, 2));
