import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildContentSecurityPolicy, buildCorsHeaders, buildSecurityHeaders } from '../src/lib/security/security-headers';
import { MemoryRateLimitStore } from '../src/lib/rate-limit/memory-store';
import { UpstashRateLimitStore } from '../src/lib/rate-limit/upstash-store';
import { RateLimiter, buildRateLimitKey, getConfiguredRateLimiter } from '../src/lib/rate-limit/rate-limiter';
import { ConfigurationError, ValidationError } from '../src/lib/api-errors';
import { LocalStorageProvider } from '../src/lib/storage/local-storage-provider';
import { SupabaseStorageProvider } from '../src/lib/storage/supabase-storage-provider';

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

test('rate limiter rejects process-local stores and accepts configured Upstash in production', () => {
  assert.throws(
    () => getConfiguredRateLimiter({ APP_ENV: 'production', RATE_LIMIT_PROVIDER: 'memory' }),
    ConfigurationError,
  );
  assert.doesNotThrow(() => getConfiguredRateLimiter({
    APP_ENV: 'production',
    RATE_LIMIT_PROVIDER: 'upstash',
    RATE_LIMIT_URL: 'https://example.upstash.io',
    RATE_LIMIT_TOKEN: 'test-token',
  }));
  assert.doesNotThrow(() => getConfiguredRateLimiter({ APP_ENV: 'test', RATE_LIMIT_PROVIDER: 'memory' }));
});

test('Upstash store performs an atomic increment with a bounded TTL', async () => {
  let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
  const store = new UpstashRateLimitStore({
    url: 'https://example.upstash.io',
    token: 'secret-token',
    fetchImpl: async (input, init) => {
      request = { input, init };
      return Response.json({ result: [2, 750] });
    },
  });
  const result = await store.increment('registration:hashed', { name: 'registration', limit: 3, windowMs: 1000 }, 5000);
  assert.deepEqual(result, { count: 2, resetAt: 5750 });
  assert.equal(String(request?.input), 'https://example.upstash.io');
  assert.equal(new Headers(request?.init?.headers).get('authorization'), 'Bearer secret-token');
  const body = JSON.parse(String(request?.init?.body)) as string[];
  assert.equal(body[0], 'EVAL');
  assert.equal(body[2], '1');
  assert.equal(body[3], 'pcs:rate-limit:registration:hashed');
  assert.equal(body[4], '1000');
});

test('Upstash store fails closed on malformed dependency responses', async () => {
  const store = new UpstashRateLimitStore({
    url: 'https://example.upstash.io',
    token: 'secret-token',
    fetchImpl: async () => Response.json({ result: 'unexpected' }),
  });
  await assert.rejects(
    () => store.increment('key', { name: 'test', limit: 1, windowMs: 1000 }, 1000),
    /invalid response/,
  );
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

test('Supabase storage implements authenticated durable object operations', async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const responses = [
    new Response('{}', { status: 200 }),
    new Response(new Uint8Array([7, 8, 9]), { status: 200 }),
    new Response(new Uint8Array([7]), { status: 206 }),
    new Response(null, { status: 200 }),
    new Response('{}', { status: 200 }),
  ];
  const provider = new SupabaseStorageProvider({
    url: 'https://project.supabase.co/',
    serviceRoleKey: 'service-role-secret',
    bucket: 'creator-assets',
    fetchImpl: async (input, init) => {
      requests.push({ input, init });
      const response = responses.shift();
      assert.ok(response);
      return response;
    },
  });

  const saved = await provider.save({
    key: 'projects/demo/panel-one.png',
    data: new Uint8Array([7, 8, 9]),
    contentType: 'image/png',
  });
  assert.equal(saved.size, 3);
  assert.deepEqual([...await provider.read(saved.key)], [7, 8, 9]);
  assert.equal(await provider.exists(saved.key), true);
  await provider.delete(saved.key);
  assert.deepEqual(await provider.probe(), { ok: true, provider: 'supabase' });

  assert.equal(
    String(requests[0].input),
    'https://project.supabase.co/storage/v1/object/creator-assets/projects/demo/panel-one.png',
  );
  assert.equal(new Headers(requests[0].init?.headers).get('authorization'), 'Bearer service-role-secret');
  assert.equal(requests[0].init?.method, 'POST');
  assert.equal(requests[3].init?.method, 'DELETE');
  assert.match(String(requests[4].input), /\/storage\/v1\/bucket\/creator-assets$/);
});

test('Supabase storage rejects traversal before issuing a request', async () => {
  let called = false;
  const provider = new SupabaseStorageProvider({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'service-role-secret',
    bucket: 'creator-assets',
    fetchImpl: async () => {
      called = true;
      return new Response('{}');
    },
  });
  await assert.rejects(() => provider.read('../secret'), ValidationError);
  assert.equal(called, false);
});
