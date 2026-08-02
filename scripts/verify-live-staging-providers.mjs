import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

const EVIDENCE_PATH = 'live-provider-evidence.json';
const required = (key) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

const appEnvironment = required('APP_ENV').toLowerCase();
if (appEnvironment !== 'staging') throw new Error('Live provider verification requires APP_ENV=staging.');
if (process.env.STAGING_CONFIRM_ISOLATED !== 'true') {
  throw new Error('STAGING_CONFIRM_ISOLATED=true is required after confirming no production data or credentials are used.');
}

const supabaseUrl = new URL(required('SUPABASE_URL'));
const supabaseKey = required('SUPABASE_SERVICE_ROLE_KEY');
const supabaseBucket = required('SUPABASE_STORAGE_BUCKET');
const rateLimitUrl = new URL(required('RATE_LIMIT_URL'));
const rateLimitToken = required('RATE_LIMIT_TOKEN');

for (const [name, url] of [['SUPABASE_URL', supabaseUrl], ['RATE_LIMIT_URL', rateLimitUrl]]) {
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS.`);
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())) {
    throw new Error(`${name} must target a remote staging service.`);
  }
}

const runId = randomUUID();
const storageKey = `staging-probes/${runId}.txt`;
const storageBytes = new TextEncoder().encode(`phoenix-creator-studio-staging-probe:${runId}`);
const redisKey = `pcs:staging-probe:${runId}`;
const startedAt = Date.now();
const evidence = {
  ok: false,
  runId,
  environment: appEnvironment,
  startedAt: new Date(startedAt).toISOString(),
  providers: {
    storage: { provider: 'supabase', bucket: supabaseBucket, ok: false },
    rateLimit: { provider: 'upstash', ok: false },
  },
};

function supabaseHeaders(extra = {}) {
  return {
    apikey: supabaseKey,
    authorization: `Bearer ${supabaseKey}`,
    ...extra,
  };
}

function encodedStoragePath(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function objectUrl(key) {
  return `${supabaseUrl.toString().replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${encodedStoragePath(key)}`;
}

async function requireResponse(response, label, expectedStatuses = [200]) {
  if (!expectedStatuses.includes(response.status)) {
    const body = await response.text().catch(() => '');
    throw new Error(`${label} failed with status ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
  }
  return response;
}

async function upstash(command) {
  const response = await fetch(rateLimitUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${rateLimitToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  await requireResponse(response, `Upstash ${command[0]}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Upstash ${command[0]} failed: ${payload.error}`);
  return payload.result;
}

async function verifyStorage() {
  const bucketProbe = await fetch(
    `${supabaseUrl.toString().replace(/\/$/, '')}/storage/v1/bucket/${encodeURIComponent(supabaseBucket)}`,
    { headers: supabaseHeaders() },
  );
  await requireResponse(bucketProbe, 'Supabase bucket probe');

  await requireResponse(
    await fetch(objectUrl(storageKey), {
      method: 'POST',
      headers: supabaseHeaders({
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': '60',
        'x-upsert': 'false',
      }),
      body: storageBytes,
    }),
    'Supabase object write',
    [200, 201],
  );

  const readResponse = await requireResponse(
    await fetch(objectUrl(storageKey), { headers: supabaseHeaders() }),
    'Supabase object read',
  );
  const readBytes = new Uint8Array(await readResponse.arrayBuffer());
  const expectedHash = createHash('sha256').update(storageBytes).digest('hex');
  const actualHash = createHash('sha256').update(readBytes).digest('hex');
  if (expectedHash !== actualHash) throw new Error('Supabase object readback hash does not match the written bytes.');

  await requireResponse(
    await fetch(objectUrl(storageKey), { method: 'DELETE', headers: supabaseHeaders() }),
    'Supabase object delete',
    [200, 204],
  );

  const deletedRead = await fetch(objectUrl(storageKey), { headers: supabaseHeaders() });
  if (deletedRead.ok) throw new Error('Supabase object remained readable after deletion.');

  evidence.providers.storage = {
    provider: 'supabase',
    bucket: supabaseBucket,
    ok: true,
    byteCount: storageBytes.byteLength,
    sha256: expectedHash,
  };
}

async function verifyRateLimit() {
  const script = [
    "local count = redis.call('INCR', KEYS[1])",
    "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
    "local ttl = redis.call('PTTL', KEYS[1])",
    'return {count, ttl}',
  ].join('\n');

  const first = await upstash(['EVAL', script, '1', redisKey, '60000']);
  const second = await upstash(['EVAL', script, '1', redisKey, '60000']);
  if (!Array.isArray(first) || Number(first[0]) !== 1 || Number(first[1]) <= 0) {
    throw new Error('Upstash first atomic rate-limit result is invalid.');
  }
  if (!Array.isArray(second) || Number(second[0]) !== 2 || Number(second[1]) <= 0) {
    throw new Error('Upstash second atomic rate-limit result is invalid.');
  }
  const deleted = Number(await upstash(['DEL', redisKey]));
  if (deleted !== 1) throw new Error('Upstash staging probe key was not deleted exactly once.');

  evidence.providers.rateLimit = {
    provider: 'upstash',
    ok: true,
    firstCount: Number(first[0]),
    secondCount: Number(second[0]),
    ttlMs: Number(second[1]),
  };
}

try {
  await verifyStorage();
  await verifyRateLimit();
  evidence.ok = true;
} finally {
  if (!evidence.providers.storage.ok) {
    await fetch(objectUrl(storageKey), { method: 'DELETE', headers: supabaseHeaders() }).catch(() => undefined);
  }
  if (!evidence.providers.rateLimit.ok) {
    await upstash(['DEL', redisKey]).catch(() => undefined);
  }
  evidence.completedAt = new Date().toISOString();
  evidence.durationMs = Date.now() - startedAt;
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  fs.writeFileSync(EVIDENCE_PATH, serialized, 'utf8');
  console.log(serialized.trimEnd());
}

if (!evidence.ok) process.exitCode = 1;
