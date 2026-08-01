import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildContentSecurityPolicy, buildCorsHeaders, buildSecurityHeaders } from '../src/lib/security/security-headers';
import { MemoryRateLimitStore } from '../src/lib/rate-limit/memory-store';
import { RateLimiter, buildRateLimitKey, getConfiguredRateLimiter } from '../src/lib/rate-limit/rate-limiter';
import { ConfigurationError, ValidationError } from '../src/lib/api-errors';
import { LocalStorageProvider } from '../src/lib/storage/local-storage-provider';

test('production security headers include HSTS and strict framing without development eval', () => {
  const headers = buildSecurityHeaders({
    production: true,
    allowedConnectOrigins: ['https://example.supabase.co/path', 'not-a-url'],
  });
  const map = new Map(headers.map((header) => [header.key, header.value]));
  assert.match(map.get('Strict-Transport-Security') || '', /max-age=31536000/);
  assert.equal(map.get('X-Frame-Options'), 'DENY');
  assert.match(map.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
  assert.match(map.get('Content-Security-Policy') || '', /https:\/\/example\.supabase\.co/);
  assert.doesNotMatch(map.get('Content-Security-Policy') || '', /unsafe-eval/);
});

test('development CSP supports local tooling but does not emit HSTS', () => {
  const headers = buildSecurityHeaders({ production: false });
  const map = new Map(headers.map((header) => [header.key, header.value]));
  assert.equal(map.has('Strict-Transport-Security'), false);
  assert.match(buildContentSecurityPolicy({ production: false }), /unsafe-eval/);
  assert.match(buildContentSecurityPolicy({ production: false }), /ws:/);
});

test('production CORS fails closed without an allowlisted origin', () => {
  assert.deepEqual(buildCorsHeaders(undefined, true), []);
  const headers = buildCorsHeaders('https://rainstorms.example.com', true);
  assert.equal(headers.find((header) => header.key === 'Access-Control-Allow-Origin')?.value, 'https://rainstorms.example.com');
  assert.equal(buildCorsHeaders(undefined, false)[0].value, '*');
});

test('memory rate limiter enforces a fixed window and resets', async () => {
  const limiter = new RateLimiter(new MemoryRateLimitStore());
  const policy = { name: 'test', limit: 2, windowMs: 1000 };
  const first = await limiter.consume('key', policy, 1000);
  const second = await limiter.consume('key', policy, 1100);
  const third = await limiter.consume('key', policy, 1200);
  const reset = await limiter.consume('key', policy, 2000);

  assert.equal(first.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterSeconds, 1);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
});

test('rate limiter rejects process-local or unavailable shared stores in production', () => {
  assert.throws(
    () => getConfiguredRateLimiter({ APP_ENV: 'production', RATE_LIMIT_PROVIDER: 'memory' }),
    ConfigurationError,
  );
  assert.throws(
    () => getConfiguredRateLimiter({ APP_ENV: 'production', RATE_LIMIT_PROVIDER: 'upstash' }),
    ConfigurationError,
  );
  assert.doesNotThrow(() => getConfiguredRateLimiter({ APP_ENV: 'test', RATE_LIMIT_PROVIDER: 'memory' }));
});

test('rate-limit keys are stable and do not expose raw client addresses', () => {
  const request = new Request('https://studio.example.com/api/auth/register', {
    headers: { 'x-forwarded-for': '203.0.113.25, 10.0.0.1' },
  });
  const first = buildRateLimitKey(request, 'registration');
  const second = buildRateLimitKey(request, 'registration');
  assert.equal(first, second);
  assert.doesNotMatch(first, /203\.0\.113\.25/);
});

test('local storage provider saves, reads, probes, and deletes within its root', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pcs-storage-'));
  const provider = new LocalStorageProvider(root);
  try {
    const saved = await provider.save({
      key: 'projects/test/panel.png',
      data: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    });
    assert.equal(saved.key, 'projects/test/panel.png');
    assert.equal(await provider.exists(saved.key), true);
    assert.deepEqual([...await provider.read(saved.key)], [1, 2, 3]);
    assert.deepEqual(await provider.probe(), { ok: true, provider: 'local' });
    await provider.delete(saved.key);
    assert.equal(await provider.exists(saved.key), false);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test('local storage provider rejects traversal and absolute keys', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pcs-storage-'));
  const provider = new LocalStorageProvider(root);
  try {
    await assert.rejects(
      () => provider.save({ key: '../escape.png', data: new Uint8Array([1]), contentType: 'image/png' }),
      ValidationError,
    );
    await assert.rejects(
      () => provider.read('/tmp/escape.png'),
      ValidationError,
    );
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});
