const required = (key) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required for the staging runner.`);
  return value;
};

if (required('APP_ENV') !== 'staging') throw new Error('APP_ENV must be staging.');
if (process.env.STAGING_CONFIRM_ISOLATED !== 'true') throw new Error('STAGING_CONFIRM_ISOLATED=true is required.');
if (process.env.ALLOW_REMOTE_TESTS !== 'true') throw new Error('ALLOW_REMOTE_TESTS=true is required.');
const baseUrl = new URL(required('STAGING_BASE_URL'));
const productionUrl = new URL(required('PRODUCTION_BASE_URL'));
if (baseUrl.protocol !== 'https:') throw new Error('STAGING_BASE_URL must use HTTPS.');
if (baseUrl.origin === productionUrl.origin) throw new Error('Staging and production origins must differ.');
if (!/^[0-9a-f]{40}$/i.test(required('DEPLOYMENT_COMMIT_SHA'))) throw new Error('DEPLOYMENT_COMMIT_SHA must be a full SHA.');
if (!/^[0-9a-f]{40}$/i.test(required('ROLLBACK_COMMIT_SHA'))) throw new Error('ROLLBACK_COMMIT_SHA must be a full SHA.');
if (!/^[a-z][a-z0-9_]{2,62}$/.test(required('DATABASE_SCHEMA')) || process.env.DATABASE_SCHEMA === 'public') {
  throw new Error('DATABASE_SCHEMA must be a non-public staging schema.');
}
if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{2,95}$/.test(required('RATE_LIMIT_NAMESPACE'))) {
  throw new Error('RATE_LIMIT_NAMESPACE must be a safe staging namespace.');
}
if (required('STAGING_AUTOMATION_TOKEN').length < 32) throw new Error('STAGING_AUTOMATION_TOKEN is too short.');
if (required('VERCEL_AUTOMATION_BYPASS_SECRET').length < 24) throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is too short.');

console.log(JSON.stringify({
  ok: true,
  stagingOrigin: baseUrl.origin,
  databaseSchema: process.env.DATABASE_SCHEMA,
  rateLimitNamespace: process.env.RATE_LIMIT_NAMESPACE,
  automationTokenPresent: true,
  vercelBypassPresent: true,
}, null, 2));
