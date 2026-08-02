import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { evaluateReadiness, type DependencyCheck } from '@/lib/readiness';

function storageCheck(): DependencyCheck {
  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  if (provider === 'local') {
    const production = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
    return {
      name: 'storage',
      required: true,
      ok: !production && Boolean(process.env.STORAGE_PATH || 'storage/uploads'),
      detail: production ? 'Local storage is not accepted for production readiness.' : 'Local storage configured.',
    };
  }
  if (provider === 'supabase') {
    return {
      name: 'storage',
      required: true,
      ok: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET),
      detail: 'Supabase storage configuration checked without exposing credentials.',
    };
  }
  return { name: 'storage', required: true, ok: false, detail: 'Unsupported storage provider.' };
}

function rateLimitCheck(): DependencyCheck {
  const provider = (process.env.RATE_LIMIT_PROVIDER || 'memory').toLowerCase();
  const production = process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (provider === 'memory') {
    return {
      name: 'rate-limit',
      required: true,
      ok: !production,
      detail: production ? 'In-memory rate limiting is not accepted for production readiness.' : 'In-memory test/development rate limiter configured.',
    };
  }
  if (provider === 'redis' || provider === 'upstash') {
    return {
      name: 'rate-limit',
      required: true,
      ok: Boolean(process.env.RATE_LIMIT_URL && process.env.RATE_LIMIT_TOKEN),
      detail: 'Distributed rate-limit configuration checked without exposing credentials.',
    };
  }
  return { name: 'rate-limit', required: true, ok: false, detail: 'Unsupported rate-limit provider.' };
}

export async function GET() {
  const checks: DependencyCheck[] = [storageCheck(), rateLimitCheck()];
  const startedAt = Date.now();
  if (!db) {
    checks.push({ name: 'database', required: true, ok: false, detail: 'Database is not configured.' });
  } else {
    try {
      await db.execute(sql`SELECT 1`);
      checks.push({ name: 'database', required: true, ok: true, latencyMs: Date.now() - startedAt });
    } catch {
      checks.push({ name: 'database', required: true, ok: false, latencyMs: Date.now() - startedAt, detail: 'Database probe failed.' });
    }
  }

  checks.push({
    name: 'ai-provider',
    required: false,
    ok: Boolean(process.env.OPENAI_API_KEY),
    detail: process.env.OPENAI_API_KEY ? 'AI provider configured.' : 'AI provider is optional; mock/local workflows remain available.',
  });

  const report = evaluateReadiness(checks);
  return NextResponse.json({ ok: report.httpStatus === 200, data: report }, { status: report.httpStatus });
}

export const dynamic = 'force-dynamic';
