import test from 'node:test';
import assert from 'node:assert/strict';
import { validateServerEnvironment } from '../src/lib/env-validator';
import { REDACTED, redactSensitive } from '../src/lib/redact-sensitive';
import { PayloadTooLargeError, UnsupportedMediaTypeError, ValidationError } from '../src/lib/api-errors';
import { readBase64PayloadWithLimit, readJsonBodyWithLimit, readRequestBytes } from '../src/lib/http/read-bounded-body';
import type { BodyLimitPolicy } from '../src/lib/http/body-limits';
import { validateUpload } from '../src/lib/uploads/validate-upload';
import { createStorageIdentity } from '../src/lib/uploads/storage-key';
import { createRequestContext, REQUEST_ID_HEADER } from '../src/lib/request-context';
import { createLogger } from '../src/lib/logger';

const tinyPolicy = (maxBytes: number): BodyLimitPolicy => ({ name: 'test', maxBytes });

function productionEnvironment(): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://runtime.example/app',
    DATABASE_MIGRATION_URL: 'postgresql://migration.example/app',
    NEXTAUTH_SECRET: 'a-secure-production-secret-that-is-long-enough',
    NEXTAUTH_URL: 'https://studio.example.com',
    STORAGE_PROVIDER: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-value',
    SUPABASE_STORAGE_BUCKET: 'private-assets',
    RATE_LIMIT_PROVIDER: 'upstash',
    RATE_LIMIT_URL: 'https://rate-limit.example.com',
    RATE_LIMIT_TOKEN: 'rate-limit-token',
  };
}

test('environment validator accepts development defaults', () => {
  const result = validateServerEnvironment({ NODE_ENV: 'development' });
  assert.equal(result.ok, true);
  assert.equal(result.value?.storageProvider, 'local');
  assert.equal(result.value?.rateLimitProvider, 'memory');
});

test('deployment validator accepts complete production configuration', () => {
  const result = validateServerEnvironment(productionEnvironment(), 'deployment');
  assert.equal(result.ok, true);
});

test('production validator rejects weak secrets, local storage, and memory limiting without leaking values', () => {
  const env = productionEnvironment();
  env.NEXTAUTH_SECRET = 'top-secret-value';
  env.STORAGE_PROVIDER = 'local';
  env.RATE_LIMIT_PROVIDER = 'memory';
  const result = validateServerEnvironment(env, 'deployment');
  assert.equal(result.ok, false);
  const serialized = JSON.stringify(result);
  assert.match(serialized, /NEXTAUTH_SECRET/);
  assert.match(serialized, /Local filesystem storage/);
  assert.match(serialized, /Memory-only rate limiting/);
  assert.doesNotMatch(serialized, /top-secret-value/);
});

test('redaction removes sensitive fields and credential-bearing strings', () => {
  const result = redactSensitive({
    password: 'hunter2',
    nested: { authorization: 'Bearer abc.def.ghi' },
    message: 'failed postgresql://user:pass@example.com/db',
  });
  assert.equal(result.password, REDACTED);
  assert.equal(result.nested.authorization, REDACTED);
  assert.equal(result.message.includes('user:pass'), false);
});

test('bounded JSON reader accepts a body under its limit', async () => {
  const request = new Request('http://test.local', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  });
  const result = await readJsonBodyWithLimit<{ ok: boolean }>(request, { policy: tinyPolicy(64) });
  assert.equal(result.ok, true);
});

test('bounded reader rejects declared and actual oversized bodies', async () => {
  const declared = new Request('http://test.local', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '100' },
    body: '{}',
  });
  await assert.rejects(() => readJsonBodyWithLimit(declared, { policy: tinyPolicy(8) }), PayloadTooLargeError);

  const actual = new Request('http://test.local', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: '123456',
  });
  await assert.rejects(() => readRequestBytes(actual, { policy: tinyPolicy(5) }), PayloadTooLargeError);
});

test('bounded JSON reader counts UTF-8 bytes and separates malformed JSON from media errors', async () => {
  const multibyte = new Request('http://test.local', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '"ééé"',
  });
  await assert.rejects(() => readJsonBodyWithLimit(multibyte, { policy: tinyPolicy(5) }), PayloadTooLargeError);

  const malformed = new Request('http://test.local', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad',
  });
  await assert.rejects(() => readJsonBodyWithLimit(malformed, { policy: tinyPolicy(64) }), ValidationError);

  const unsupported = new Request('http://test.local', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{}',
  });
  await assert.rejects(() => readJsonBodyWithLimit(unsupported, { policy: tinyPolicy(64) }), UnsupportedMediaTypeError);
});

test('base64 reader enforces decoded byte size', () => {
  const encoded = Buffer.from('123456').toString('base64');
  assert.throws(() => readBase64PayloadWithLimit(encoded, { policy: tinyPolicy(5) }), PayloadTooLargeError);
  assert.equal(readBase64PayloadWithLimit(encoded, { policy: tinyPolicy(6) }).toString(), '123456');
});

test('upload validator accepts signed PNG and rejects spoofing and traversal', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const valid = new File([png], 'panel.png', { type: 'image/png' });
  const result = await validateUpload(valid);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.extension, '.png');

  const spoofed = new File([png], 'panel.jpg', { type: 'image/png' });
  await assert.rejects(() => validateUpload(spoofed), UnsupportedMediaTypeError);

  const traversal = new File([png], '../panel.png', { type: 'image/png' });
  await assert.rejects(() => validateUpload(traversal), ValidationError);
});

test('storage identities are generated independently and uniquely', () => {
  const first = createStorageIdentity('panel.webp');
  const second = createStorageIdentity('panel.webp');
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.key, second.key);
  assert.equal(first.extension, '.webp');
});

test('request context accepts safe correlation IDs and rejects malformed values', () => {
  const accepted = createRequestContext(new Request('http://test.local/path', { headers: { [REQUEST_ID_HEADER]: 'request-12345678' } }));
  assert.equal(accepted.requestId, 'request-12345678');

  const rejected = createRequestContext(new Request('http://test.local/path', { headers: { [REQUEST_ID_HEADER]: 'bad\nvalue' } }));
  assert.notEqual(rejected.requestId, 'bad\nvalue');
});

test('structured logger redacts secrets and control characters', () => {
  const original = console.log;
  const lines: string[] = [];
  console.log = (line?: unknown) => lines.push(String(line));
  try {
    createLogger({ requestId: 'request-12345678', route: '/test', method: 'POST' }).info('line\nbreak', {
      password: 'private',
      detail: 'postgresql://user:pass@example.com/db',
    });
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 1);
  assert.doesNotMatch(lines[0], /private|user:pass|line\\nbreak/);
  assert.match(lines[0], /request-12345678/);
});
