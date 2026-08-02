import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { createLogger } from '@/lib/logger';
import { getConfiguredRateLimiter } from '@/lib/rate-limit/rate-limiter';
import { evaluateReadiness, type DependencyCheck } from '@/lib/readiness';
import { getStorageProvider } from '@/lib/storage';

function environmentName(): string {
  return (process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development').toLowerCase();
}

function productionLike(): boolean {
  return ['production', 'staging', 'preview'].includes(environmentName());
}

async function storageCheck(): Promise<DependencyCheck> {
  const providerName = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  if (providerName === 'local' && productionLike()) {
    return {
      name: 'storage',
      required: true,
      ok: false,
      detail: 'Local storage is not accepted for staging or production readiness.',
    };
  }

  const startedAt = Date.now();
  try {
    const result = await getStorageProvider().probe();
    return {
      name: 'storage',
      required: true,
      ok: result.ok,
      latencyMs: Date.now() - startedAt,
      detail: `${result.provider} storage probe completed.`,
    };
  } catch (error) {
    createLogger().warn('readiness.storage.failed', { provider: providerName, error });
    return {
      name: 'storage',
      required: true,
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: 'Storage probe failed.',
    };
  }
}

async function rateLimitCheck(): Promise<DependencyCheck> {
  const providerName = (process.env.RATE_LIMIT_PROVIDER || 'memory').toLowerCase();
  if (providerName === 'memory' && productionLike()) {
    return {
      name: 'rate-limit',
      required: true,
      ok: false,
      detail: 'In-memory rate limiting is not accepted for staging or production readiness.',
    };
  }

  const startedAt = Date.now();
  try {
    const limiter = getConfiguredRateLimiter();
    const result = await limiter.consume(
      `readiness:${crypto.randomUUID()}`,
      { name: 'readiness', limit: 1, windowMs: 1_000 },
    );
    return {
      name: 'rate-limit',
      required: true,
      ok: result.allowed,
      latencyMs: Date.now() - startedAt,
      detail: `${providerName} rate-limit probe completed.`,
    };
  } catch (error) {
    createLogger().warn('readiness.rate-limit.failed', { provider: providerName, error });
    return {
      name: 'rate-limit',
      required: true,
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: 'Rate-limit probe failed.',
    };
  }
}

async function databaseCheck(): Promise<DependencyCheck> {
  const startedAt = Date.now();
  if (!db) return { name: 'database', required: true, ok: false, detail: 'Database is not configured.' };
  try {
    await db.execute(sql`SELECT 1`);
    return { name: 'database', required: true, ok: true, latencyMs: Date.now() - startedAt };
  } catch {
    return {
      name: 'database',
      required: true,
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: 'Database probe failed.',
    };
  }
}

export async function GET() {
  const checks = await Promise.all([
    storageCheck(),
    rateLimitCheck(),
    databaseCheck(),
  ]);

  checks.push({
    name: 'ai-provider',
    required: false,
    ok: Boolean(process.env.OPENAI_API_KEY),
    detail: process.env.OPENAI_API_KEY
      ? 'AI provider configured.'
      : 'AI provider is optional; mock/local workflows remain available.',
  });

  const report = evaluateReadiness(checks);
  return NextResponse.json({ ok: report.httpStatus === 200, data: report }, { status: report.httpStatus });
}

export const dynamic = 'force-dynamic';
