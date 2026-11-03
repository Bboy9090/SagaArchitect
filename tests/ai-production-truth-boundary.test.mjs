import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const generationRoutes = [
  'src/app/api/generate/universe/route.ts',
  'src/app/api/generate/arc/route.ts',
  'src/app/api/generate/factions/route.ts',
  'src/app/api/generate/locations/route.ts',
  'src/app/api/generate/timeline/route.ts',
  'src/app/api/generate/characters/route.ts',
  'src/app/api/generate/story/route.ts',
  'src/app/api/shared-lore-pool/generate/route.ts',
  'src/app/api/director/plan/route.ts',
];

test('production generation routes import the fail-closed AI policy', () => {
  for (const path of generationRoutes) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /ai-generation-policy/, `${path} must use the shared AI generation truth policy`);
  }
});

test('AI truth policy rejects production-like mock generation', () => {
  const source = readFileSync('src/lib/ai-generation-policy.ts', 'utf8');
  assert.match(source, /production.*staging.*preview/s);
  assert.match(source, /AI_PROVIDER_NOT_CONFIGURED/);
  assert.match(source, /AI_PROVIDER_FAILED/);
  assert.match(source, /x-phoenix-generation-mode/);
});

test('production readiness requires the live AI provider', () => {
  const source = readFileSync('src/app/api/health/ready/route.ts', 'utf8');
  assert.match(source, /name: 'ai-provider'/);
  assert.match(source, /required: productionLike\(\)/);
  assert.match(source, /production-like environments do not return mock generation/);
});
