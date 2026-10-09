import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getConfiguredRateLimiter } from '@/lib/rate-limit/rate-limiter';
import { getStorageProvider } from '@/lib/storage/index';
import {
  assertStagingAutomationRequest,
  StagingAutomationError,
} from '@/lib/staging-automation';

export async function POST(request: Request) {
  try {
    assertStagingAutomationRequest(request);
    if (!db) return NextResponse.json({ ok: false, error: 'Database unavailable.' }, { status: 503 });

    const storage = getStorageProvider();
    if (storage.name !== 'supabase') {
      return NextResponse.json({ ok: false, error: 'Staging storage is not Supabase.' }, { status: 503 });
    }
    if ((process.env.RATE_LIMIT_PROVIDER || '').toLowerCase() !== 'upstash') {
      return NextResponse.json({ ok: false, error: 'Staging rate limiting is not Upstash.' }, { status: 503 });
    }

    const runId = randomUUID();
    const key = `staging-probes/${runId}.txt`;
    const bytes = new TextEncoder().encode(`phoenix-staging-probe:${runId}`);
    const startedAt = Date.now();
    let storageWritten = false;

    try {
      await db.execute(sql`SELECT 1`);
      const storageProbe = await storage.probe();
      if (!storageProbe.ok) throw new Error('Storage provider probe failed.');

      await storage.save({
        key,
        data: bytes,
        contentType: 'text/plain; charset=utf-8',
        cacheControl: '60',
      });
      storageWritten = true;
      const readBytes = await storage.read(key);
      const expectedHash = createHash('sha256').update(bytes).digest('hex');
      const actualHash = createHash('sha256').update(readBytes).digest('hex');
      if (expectedHash !== actualHash) throw new Error('Storage readback hash mismatch.');
      await storage.delete(key);
      storageWritten = false;
      if (await storage.exists(key)) throw new Error('Storage probe object remained after deletion.');

      const limiter = getConfiguredRateLimiter();
      const policy = { name: 'staging-provider-probe', limit: 3, windowMs: 2_000 };
      const limiterKey = `provider-probe:${runId}`;
      const first = await limiter.consume(limiterKey, policy);
      const second = await limiter.consume(limiterKey, policy);
      if (!first.allowed || !second.allowed || second.remaining >= first.remaining) {
        throw new Error('Distributed rate-limit probe did not advance atomically.');
      }

      return NextResponse.json({
        ok: true,
        data: {
          runId,
          environment: 'staging',
          database: { ok: true, schema: process.env.DATABASE_SCHEMA || null },
          storage: {
            ok: true,
            provider: storage.name,
            byteCount: bytes.byteLength,
            sha256: expectedHash,
          },
          rateLimit: {
            ok: true,
            provider: 'upstash',
            namespace: process.env.RATE_LIMIT_NAMESPACE || null,
            firstRemaining: first.remaining,
            secondRemaining: second.remaining,
          },
          durationMs: Date.now() - startedAt,
        },
      });
    } finally {
      if (storageWritten) await storage.delete(key).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StagingAutomationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Staging provider probe failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
