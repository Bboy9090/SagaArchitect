export function stagingAutomationConfiguration(environment = process.env) {
  const baseUrl = environment.STAGING_BASE_URL?.trim();
  const token = environment.STAGING_AUTOMATION_TOKEN?.trim();
  if (environment.APP_ENV !== 'staging') throw new Error('Staging automation requires APP_ENV=staging.');
  if (environment.STAGING_CONFIRM_ISOLATED !== 'true' || environment.ALLOW_REMOTE_TESTS !== 'true') {
    throw new Error('Staging automation requires explicit isolation and remote-test approval.');
  }
  if (!baseUrl || new URL(baseUrl).protocol !== 'https:') {
    throw new Error('STAGING_BASE_URL must be a remote HTTPS URL.');
  }
  if (environment.PRODUCTION_BASE_URL && new URL(environment.PRODUCTION_BASE_URL).origin === new URL(baseUrl).origin) {
    throw new Error('Staging automation refuses the configured production origin.');
  }
  if (!token || token.length < 32) throw new Error('STAGING_AUTOMATION_TOKEN is required.');
  const vercelBypass = environment.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() || null;
  return { baseUrl, token, vercelBypass };
}

export async function stagingAutomationPost(path, environment = process.env) {
  const { baseUrl, token, vercelBypass } = stagingAutomationConfiguration(environment);
  const response = await fetch(new URL(path, baseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(vercelBypass ? { 'x-vercel-protection-bypass': vercelBypass } : {}),
    },
    body: '{}',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true) {
    const safeError = body?.error ? String(body.error).slice(0, 300) : `HTTP ${response.status}`;
    throw new Error(`Staging automation ${path} failed: ${safeError}`);
  }
  return body;
}
