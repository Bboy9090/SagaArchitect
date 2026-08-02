/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const { randomUUID } = require('node:crypto');

const BASE_URL = process.env.STAGING_BASE_URL || process.env.TEST_BASE_URL;
const DATABASE_URL = process.env.DATABASE_MIGRATION_URL;
const EXPECTED_COMMIT = process.env.DEPLOYMENT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;

function requireConfiguration() {
  if (process.env.APP_ENV !== 'staging') throw new Error('Staging acceptance requires APP_ENV=staging.');
  if (process.env.STAGING_CONFIRM_ISOLATED !== 'true') {
    throw new Error('STAGING_CONFIRM_ISOLATED=true is required after confirming no production data or credentials are used.');
  }
  if (process.env.ALLOW_REMOTE_TESTS !== 'true') {
    throw new Error('ALLOW_REMOTE_TESTS=true is required for the explicitly approved isolated staging run.');
  }
  if (!BASE_URL) throw new Error('STAGING_BASE_URL is required.');
  if (!DATABASE_URL) throw new Error('DATABASE_MIGRATION_URL is required for deterministic staging cleanup.');

  const base = new URL(BASE_URL);
  if (base.protocol !== 'https:') throw new Error('STAGING_BASE_URL must use HTTPS.');
  if (['localhost', '127.0.0.1', '::1'].includes(base.hostname.toLowerCase())) {
    throw new Error('STAGING_BASE_URL must target a remote staging deployment.');
  }
  if (process.env.PRODUCTION_BASE_URL && new URL(process.env.PRODUCTION_BASE_URL).origin === base.origin) {
    throw new Error('STAGING_BASE_URL must not match PRODUCTION_BASE_URL.');
  }
  if (!EXPECTED_COMMIT || !/^[0-9a-f]{40}$/i.test(EXPECTED_COMMIT)) {
    throw new Error('DEPLOYMENT_COMMIT_SHA must contain the exact 40-character staging commit.');
  }
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
    this.setCookieEvidence = [];
  }

  capture(response) {
    const headers = response.headers;
    let values = [];
    if (typeof headers.getSetCookie === 'function') values = headers.getSetCookie();
    if (!values.length) {
      const combined = headers.get('set-cookie');
      if (combined) values = combined.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
    }

    for (const raw of values) {
      this.setCookieEvidence.push(raw);
      const parts = raw.split(';').map((part) => part.trim());
      const separator = parts[0].indexOf('=');
      if (separator <= 0) continue;
      const name = parts[0].slice(0, separator);
      const value = parts[0].slice(separator + 1);
      const attributes = new Map(
        parts.slice(1).map((part) => {
          const index = part.indexOf('=');
          return index === -1
            ? [part.toLowerCase(), true]
            : [part.slice(0, index).toLowerCase(), part.slice(index + 1)];
        }),
      );
      const expired = attributes.get('max-age') === '0'
        || (typeof attributes.get('expires') === 'string'
          && Date.parse(attributes.get('expires')) <= Date.now());
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  secureCookieEvidence() {
    return this.setCookieEvidence.filter((value) => /next-auth/i.test(value));
  }
}

async function requestWithJar(jar, path, options = {}) {
  const headers = new Headers(options.headers || {});
  const cookie = jar.header();
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(new URL(path, BASE_URL), {
    ...options,
    headers,
    redirect: options.redirect || 'manual',
  });
  jar.capture(response);
  return response;
}

async function readJson(response, label, acceptedStatuses) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label} returned non-JSON status ${response.status}.`);
  }
  const accepted = acceptedStatuses || [...Array(300).keys()].map((value) => value + 200);
  if (!accepted.includes(response.status)) {
    throw new Error(`${label} failed with ${response.status}: ${body.error || JSON.stringify(body)}`);
  }
  return body;
}

async function csrfToken(jar) {
  const response = await requestWithJar(jar, '/api/auth/csrf');
  const body = await readJson(response, 'Auth.js CSRF token', [200]);
  if (!body.csrfToken) throw new Error('Auth.js did not return a CSRF token.');
  return body.csrfToken;
}

async function signIn(jar, email, password) {
  const csrf = await csrfToken(jar);
  const form = new URLSearchParams({
    csrfToken: csrf,
    email,
    password,
    callbackUrl: new URL('/', BASE_URL).toString(),
    json: 'true',
  });
  const response = await requestWithJar(jar, '/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (![200, 302, 303].includes(response.status)) {
    const body = await response.text().catch(() => '');
    throw new Error(`Auth.js credentials callback failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  const sessionResponse = await requestWithJar(jar, '/api/auth/session');
  const session = await readJson(sessionResponse, 'Auth.js session', [200]);
  if (!session.user?.id || session.user.email !== email) {
    throw new Error('Authenticated session does not contain the expected user identity.');
  }
  return session;
}

async function signOut(jar) {
  const csrf = await csrfToken(jar);
  const form = new URLSearchParams({
    csrfToken: csrf,
    callbackUrl: new URL('/login', BASE_URL).toString(),
    json: 'true',
  });
  const response = await requestWithJar(jar, '/api/auth/signout', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (![200, 302, 303].includes(response.status)) {
    throw new Error(`Auth.js sign-out failed with ${response.status}.`);
  }
}

function verifyCookieSecurity(jar) {
  const evidence = jar.secureCookieEvidence();
  if (!evidence.length) throw new Error('No Auth.js Set-Cookie evidence was observed.');
  const sessionCookie = evidence.find((value) => /^__Secure-next-auth\.session-token=/i.test(value));
  const csrfCookie = evidence.find((value) => /^__Host-next-auth\.csrf-token=/i.test(value));
  if (!sessionCookie) throw new Error('Secure Auth.js session cookie was not issued.');
  if (!csrfCookie) throw new Error('Host-scoped Auth.js CSRF cookie was not issued.');
  for (const cookie of [sessionCookie, csrfCookie]) {
    if (!/;\s*Secure(?:;|$)/i.test(cookie)) throw new Error('Auth.js cookie is missing Secure.');
    if (!/;\s*HttpOnly(?:;|$)/i.test(cookie)) throw new Error('Auth.js cookie is missing HttpOnly.');
    if (!/;\s*SameSite=Lax(?:;|$)/i.test(cookie)) throw new Error('Auth.js cookie is missing SameSite=Lax.');
    if (!/;\s*Path=\/(?:;|$)/i.test(cookie)) throw new Error('Auth.js cookie is missing Path=/.');
  }
  if (evidence.some((value) => /^next-auth\.session-token=/i.test(value))) {
    throw new Error('A non-secure Auth.js session cookie name was issued in staging.');
  }
}

async function deleteAsset(jar, assetId) {
  const response = await requestWithJar(jar, `/api/db/assets/${assetId}`, { method: 'DELETE' });
  if (![200, 404].includes(response.status)) {
    throw new Error(`Asset cleanup failed for ${assetId} with ${response.status}.`);
  }
}

async function deleteProject(jar, projectId) {
  const response = await requestWithJar(jar, `/api/db/projects/${projectId}`, {
    method: 'DELETE',
    headers: { 'x-confirm-project-id': projectId },
  });
  if (![200, 404].includes(response.status)) {
    throw new Error(`Project cleanup failed for ${projectId} with ${response.status}.`);
  }
}

async function run() {
  requireConfiguration();
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  const jar = new CookieJar();
  const suffix = randomUUID().slice(0, 8);
  const email = `pcs-staging-${suffix}@example.test`;
  const password = `PCS-Staging-${suffix}-Password!`;
  const projectId = randomUUID();
  const characterId = randomUUID();
  const sceneId = randomUUID();
  const panelId = randomUUID();
  const createdProjects = new Set();
  const createdAssets = new Set();
  let userId;
  const startedAt = Date.now();
  const evidence = {
    ok: false,
    runId: suffix,
    startedAt: new Date(startedAt).toISOString(),
    deployment: null,
    readiness: null,
    session: null,
    projectId,
    restoredProjectId: null,
    backupSha256: null,
    lifecycleReceiptId: null,
    cleanup: { projects: 0, assets: 0, user: false },
  };

  try {
    const deploymentResponse = await requestWithJar(jar, '/api/health/deployment');
    const deploymentBody = await readJson(deploymentResponse, 'Deployment identity', [200]);
    const deployment = deploymentBody.data;
    if (deployment.environment !== 'staging') throw new Error('Deployment identity is not staging.');
    if (deployment.commitSha !== EXPECTED_COMMIT.toLowerCase()) {
      throw new Error(`Deployment commit mismatch: expected ${EXPECTED_COMMIT}, received ${deployment.commitSha}.`);
    }
    if (deployment.storageProvider !== 'supabase' || deployment.rateLimitProvider !== 'upstash') {
      throw new Error('Deployment identity does not use the approved Supabase/Upstash staging architecture.');
    }
    if (!deployment.projectRestoreEnabled) throw new Error('FEATURE_PROJECT_RESTORE must be enabled for the approved staging recovery drill.');
    if (deployment.testAuthBypassEnabled) throw new Error('Test authentication bypass must be disabled in staging.');
    evidence.deployment = deployment;

    const readinessResponse = await requestWithJar(jar, '/api/health/ready');
    const readinessBody = await readJson(readinessResponse, 'Readiness probe', [200]);
    const readiness = readinessBody.data;
    const requiredFailure = (readiness.checks || []).find((check) => check.required && !check.ok);
    if (requiredFailure) throw new Error(`Required readiness check failed: ${requiredFailure.name}.`);
    evidence.readiness = readiness;

    const registrationResponse = await requestWithJar(jar, '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'PCS Staging Acceptance', email, password }),
    });
    const registration = await readJson(registrationResponse, 'Registration', [201]);
    userId = registration.data.id;

    const session = await signIn(jar, email, password);
    evidence.session = { userId: session.user.id, email: session.user.email };
    verifyCookieSecurity(jar);

    const projectResponse = await requestWithJar(jar, '/api/db/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `staging-project-${suffix}`,
      },
      body: JSON.stringify({
        id: projectId,
        name: `Staging Acceptance ${suffix}`,
        concept: 'Verify the enterprise creator and recovery path.',
        genre: 'Science Fantasy',
        themes: ['continuity', 'recovery'],
      }),
    });
    await readJson(projectResponse, 'Project creation', [201]);
    createdProjects.add(projectId);

    const characterResponse = await requestWithJar(jar, `/api/db/projects/${projectId}/characters`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: characterId,
        name: 'Staging Guardian',
        role: 'Continuity protector',
        motivations: 'Preserve verified creator work.',
        canon_status: 'canon',
      }),
    });
    await readJson(characterResponse, 'Character creation', [200, 201]);

    const sceneResponse = await requestWithJar(jar, `/api/db/projects/${projectId}/scenes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: sceneId,
        title: 'The Staging Gate',
        summary: 'A creator validates the world before release.',
        order: 1,
        canon_status: 'canon',
      }),
    });
    await readJson(sceneResponse, 'Scene creation', [200, 201]);

    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const form = new FormData();
    form.set('projectId', projectId);
    form.set('file', new Blob([pngBytes], { type: 'image/png' }), 'staging-panel.png');
    const uploadResponse = await requestWithJar(jar, '/api/db/assets/upload', {
      method: 'POST',
      body: form,
    });
    const upload = await readJson(uploadResponse, 'Private asset upload', [201]);
    const sourceAssetId = upload.data.id;
    createdAssets.add(sourceAssetId);
    if (upload.data.storageProvider !== 'supabase') throw new Error('Staging upload did not use Supabase storage.');

    const panelResponse = await requestWithJar(jar, `/api/db/scenes/${sceneId}/storyboard`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: panelId,
        panel_number: 1,
        visual_prompt: 'A verified blue gateway opens around the creator.',
        action_description: 'The staging guardian confirms the world is intact.',
        camera_shot: 'Wide Shot',
        asset_id: sourceAssetId,
      }),
    });
    await readJson(panelResponse, 'Storyboard panel creation', [201]);

    const servedResponse = await requestWithJar(jar, `/api/db/assets/${sourceAssetId}/serve`);
    if (servedResponse.status !== 200) throw new Error(`Private source asset serving failed with ${servedResponse.status}.`);
    if ((servedResponse.headers.get('cache-control') || '').toLowerCase().includes('public')) {
      throw new Error('Authenticated asset response is publicly cacheable.');
    }

    const backupResponse = await requestWithJar(jar, `/api/db/projects/${projectId}/backup?includeAssets=true`, {
      method: 'POST',
    });
    const backupBody = await readJson(backupResponse, 'Asset-byte backup', [200]);
    const backup = backupBody.data;
    if (!backup.manifest.assetBytesIncluded || backup.manifest.assetCount !== 1) {
      throw new Error('Staging backup did not include the expected asset bytes.');
    }
    evidence.backupSha256 = backup.manifest.payloadSha256;

    const preflightResponse = await requestWithJar(jar, `/api/db/projects/${projectId}/restore/preflight`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(backup),
    });
    const preflight = await readJson(preflightResponse, 'Restore preflight', [200]);
    if (!preflight.data.valid) throw new Error('Restore preflight did not validate the staging backup.');

    const restoreResponse = await requestWithJar(jar, `/api/db/projects/${projectId}/restore`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `staging-restore-${suffix}`,
        'x-restore-confirmation': 'RESTORE_AS_NEW_PROJECT',
      },
      body: JSON.stringify(backup),
    });
    const restore = await readJson(restoreResponse, 'Transactional restore', [201]);
    const restoredProjectId = restore.data.restoredProjectId;
    createdProjects.add(restoredProjectId);
    evidence.restoredProjectId = restoredProjectId;
    evidence.lifecycleReceiptId = restore.data.lifecycleReceiptId;

    const replayResponse = await requestWithJar(jar, `/api/db/projects/${projectId}/restore`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `staging-restore-${suffix}`,
        'x-restore-confirmation': 'RESTORE_AS_NEW_PROJECT',
      },
      body: JSON.stringify(backup),
    });
    const replay = await readJson(replayResponse, 'Transactional restore replay', [201]);
    if (replayResponse.headers.get('idempotency-replayed') !== 'true') {
      throw new Error('Staging restore replay was not identified as idempotent.');
    }
    if (replay.data.restoredProjectId !== restoredProjectId) {
      throw new Error('Staging restore replay returned a different project.');
    }

    const restoredAssets = await sql`
      select id from assets where project_id = ${restoredProjectId} and owner_id = ${userId}
    `;
    if (restoredAssets.length !== 1) throw new Error('Restored project does not contain exactly one owned asset.');
    const restoredAssetId = restoredAssets[0].id;
    createdAssets.add(restoredAssetId);

    const restoredServe = await requestWithJar(jar, `/api/db/assets/${restoredAssetId}/serve`);
    if (restoredServe.status !== 200) throw new Error(`Restored asset serving failed with ${restoredServe.status}.`);
    const restoredBytes = new Uint8Array(await restoredServe.arrayBuffer());
    if (Buffer.compare(Buffer.from(restoredBytes), Buffer.from(pngBytes)) !== 0) {
      throw new Error('Restored staging asset bytes do not match the source bytes.');
    }

    for (const assetId of [...createdAssets]) {
      await deleteAsset(jar, assetId);
      evidence.cleanup.assets += 1;
      createdAssets.delete(assetId);
    }
    for (const id of [...createdProjects].reverse()) {
      await deleteProject(jar, id);
      evidence.cleanup.projects += 1;
      createdProjects.delete(id);
    }

    await signOut(jar);
    const signedOutSessionResponse = await requestWithJar(jar, '/api/auth/session');
    const signedOutSession = await readJson(signedOutSessionResponse, 'Signed-out session', [200]);
    if (signedOutSession.user) throw new Error('Auth.js session remained authenticated after sign-out.');

    const unauthorizedResponse = await requestWithJar(jar, `/api/db/projects/${projectId}`);
    if (unauthorizedResponse.status !== 401 && unauthorizedResponse.status !== 404) {
      throw new Error(`Signed-out protected route returned ${unauthorizedResponse.status} instead of 401/404.`);
    }

    evidence.ok = true;
  } finally {
    if (userId) {
      const remainingAssets = await sql`
        select id, file_path, storage_provider from assets where owner_id = ${userId}
      `.catch(() => []);
      for (const asset of remainingAssets) {
        if (jar.header()) await deleteAsset(jar, asset.id).catch(() => undefined);
      }
      await sql`delete from projects where owner_id = ${userId}`.catch(() => undefined);
      await sql`delete from users where id = ${userId}`.catch(() => undefined);
      evidence.cleanup.user = true;
    } else {
      await sql`delete from users where email = ${email}`.catch(() => undefined);
    }
    await sql.end({ timeout: 5 });
    evidence.completedAt = new Date().toISOString();
    evidence.durationMs = Date.now() - startedAt;
    console.log(JSON.stringify(evidence, null, 2));
  }

  if (!evidence.ok) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : 'Staging acceptance failed.');
  process.exitCode = 1;
});
