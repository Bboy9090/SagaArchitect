import fs from 'node:fs';
import { stagingAutomationPost } from './lib/staging-automation-client.mjs';

const EVIDENCE_PATH = 'live-provider-evidence.json';
const startedAt = Date.now();
const evidence = {
  ok: false,
  environment: 'staging',
  startedAt: new Date(startedAt).toISOString(),
  providers: {
    storage: { provider: 'supabase', ok: false },
    rateLimit: { provider: 'upstash', ok: false },
    database: { provider: 'postgresql', ok: false },
  },
};

try {
  const response = await stagingAutomationPost('/api/staging/provider-probe');
  const data = response.data || {};
  if (data.storage?.provider !== 'supabase' || data.storage?.ok !== true) {
    throw new Error('Server-side Supabase provider probe did not pass.');
  }
  if (data.rateLimit?.provider !== 'upstash' || data.rateLimit?.ok !== true) {
    throw new Error('Server-side Upstash provider probe did not pass.');
  }
  if (data.database?.ok !== true) throw new Error('Server-side database provider probe did not pass.');

  evidence.runId = data.runId ?? null;
  evidence.providers.storage = {
    provider: 'supabase',
    ok: true,
    byteCount: data.storage.byteCount ?? null,
    sha256: data.storage.sha256 ?? null,
  };
  evidence.providers.rateLimit = {
    provider: 'upstash',
    ok: true,
    namespace: data.rateLimit.namespace ?? null,
    firstRemaining: data.rateLimit.firstRemaining ?? null,
    secondRemaining: data.rateLimit.secondRemaining ?? null,
  };
  evidence.providers.database = {
    provider: 'postgresql',
    ok: true,
    schema: data.database.schema ?? null,
  };
  evidence.ok = true;
} finally {
  evidence.completedAt = new Date().toISOString();
  evidence.durationMs = Date.now() - startedAt;
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  fs.writeFileSync(EVIDENCE_PATH, serialized, 'utf8');
  console.log(serialized.trimEnd());
}

if (!evidence.ok) process.exitCode = 1;
