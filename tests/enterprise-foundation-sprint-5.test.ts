import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ValidationError } from '../src/lib/api-errors';
import { validateServerEnvironment } from '../src/lib/env-validator';
import { isFeatureEnabled } from '../src/lib/feature-flags';
import {
  createProjectBackupWithAssets,
  validateProjectBackupWithAssets,
} from '../src/lib/project-backup-assets';
import {
  assertRestoreConfirmation,
  buildProjectRestorePlan,
  RESTORE_CONFIRMATION_HEADER,
  RESTORE_CONFIRMATION_VALUE,
} from '../src/lib/project-restore';
import {
  assetObjectExists,
  createAssetStorageKey,
  deleteAssetObject,
  readAssetObject,
  saveAssetObject,
} from '../src/lib/storage/asset-storage';
import { resetStorageProviderForTests } from '../src/lib/storage/index';

function validStagingEnvironment(): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'staging',
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://runtime.example/staging',
    DATABASE_MIGRATION_URL: 'postgresql://migration.example/staging',
    NEXTAUTH_SECRET: 'staging-secret-that-is-at-least-thirty-two-characters',
    NEXTAUTH_URL: 'https://staging.phoenix-creator.example',
    STORAGE_PROVIDER: 'supabase',
    SUPABASE_URL: 'https://staging-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'staging-service-role',
    SUPABASE_STORAGE_BUCKET: 'private-staging-assets',
    RATE_LIMIT_PROVIDER: 'upstash',
    RATE_LIMIT_URL: 'https://staging-rate-limit.upstash.io',
    RATE_LIMIT_TOKEN: 'staging-rate-limit-token',
    DEPLOYMENT_COMMIT_SHA: 'a'.repeat(40),
    ROLLBACK_COMMIT_SHA: 'b'.repeat(40),
    STAGING_CONFIRM_ISOLATED: 'true',
  };
}

function deterministicIdFactory(): () => string {
  let counter = 1;
  return () => `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
}

test('staging deployment validator accepts the approved isolated architecture', () => {
  const result = validateServerEnvironment(validStagingEnvironment(), 'deployment');
  assert.equal(result.ok, true);
  assert.equal(result.value?.appEnvironment, 'staging');
  assert.equal(result.value?.storageProvider, 'supabase');
  assert.equal(result.value?.rateLimitProvider, 'upstash');
  assert.equal(result.value?.stagingConfirmedIsolated, true);
});

test('staging deployment validator rejects shared URLs, wrong providers, and missing isolation evidence', () => {
  const env = validStagingEnvironment();
  env.DATABASE_MIGRATION_URL = env.DATABASE_URL;
  env.STORAGE_PROVIDER = 's3';
  env.RATE_LIMIT_PROVIDER = 'redis';
  env.STAGING_CONFIRM_ISOLATED = 'false';
  const result = validateServerEnvironment(env, 'deployment');
  assert.equal(result.ok, false);
  const messages = result.issues.map((issue) => issue.message).join('\n');
  assert.match(messages, /Runtime and migration database URLs must be separate/);
  assert.match(messages, /requires Supabase Storage/);
  assert.match(messages, /requires Upstash rate limiting/);
  assert.match(messages, /STAGING_CONFIRM_ISOLATED=true/);
});

test('staging validator rejects localhost auth and incomplete evidence SHAs', () => {
  const env = validStagingEnvironment();
  env.NEXTAUTH_URL = 'https://localhost:3000';
  env.DEPLOYMENT_COMMIT_SHA = 'abc123';
  env.ROLLBACK_COMMIT_SHA = '';
  const result = validateServerEnvironment(env, 'deployment');
  assert.equal(result.ok, false);
  const keys = new Set(result.issues.map((issue) => issue.key));
  assert.equal(keys.has('NEXTAUTH_URL'), true);
  assert.equal(keys.has('DEPLOYMENT_COMMIT_SHA'), true);
  assert.equal(keys.has('ROLLBACK_COMMIT_SHA'), true);
});

test('asset storage keys are generated from validated IDs rather than filenames', () => {
  const key = createAssetStorageKey('77777777-7777-4777-8777-777777777777', '.PNG');
  assert.equal(key, 'assets/77777777-7777-4777-8777-777777777777.png');
  assert.throws(() => createAssetStorageKey('not-a-uuid', '.png'));
  assert.throws(() => createAssetStorageKey('77777777-7777-4777-8777-777777777777', '../png'));
});

test('provider-neutral asset operations preserve private bytes through the local test adapter', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pcs-asset-storage-'));
  const previousPath = process.env.STORAGE_PATH;
  const previousProvider = process.env.STORAGE_PROVIDER;
  process.env.STORAGE_PATH = root;
  process.env.STORAGE_PROVIDER = 'local';
  resetStorageProviderForTests();

  const assetId = '77777777-7777-4777-8777-777777777777';
  try {
    const stored = await saveAssetObject({
      assetId,
      extension: '.png',
      data: new Uint8Array([1, 2, 3, 4]),
      contentType: 'image/png',
      provider: 'local',
    });
    assert.equal(stored.storageProvider, 'local');
    assert.equal(stored.storageReference, `assets/${assetId}.png`);
    assert.equal(await assetObjectExists('local', stored.storageReference), true);
    assert.deepEqual([...await readAssetObject('local', stored.storageReference)], [1, 2, 3, 4]);
    await deleteAssetObject('local', stored.storageReference);
    assert.equal(await assetObjectExists('local', stored.storageReference), false);
  } finally {
    resetStorageProviderForTests();
    if (previousPath === undefined) delete process.env.STORAGE_PATH;
    else process.env.STORAGE_PATH = previousPath;
    if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = previousProvider;
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test('asset-byte backup packages validate deterministic payload and file integrity', () => {
  const assetId = '77777777-7777-4777-8777-777777777777';
  const payload = {
    project: { id: '11111111-1111-4111-8111-111111111111', name: 'Backup Project' },
    collections: {
      assets: [{ id: assetId, name: 'panel.png', mimeType: 'image/png', fileSize: 4 }],
      characters: [],
    },
  };
  const backup = createProjectBackupWithAssets(
    payload,
    [{ id: assetId, name: 'panel.png', mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3, 4]) }],
    new Date('2026-08-02T17:00:00.000Z'),
  );
  const validation = validateProjectBackupWithAssets(backup, {
    expectedProjectId: '11111111-1111-4111-8111-111111111111',
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.assetCount, 1);
  assert.equal(validation.totalAssetBytes, 4);
  assert.equal(backup.manifest.assetBytesIncluded, true);
});

test('asset-byte backup validation rejects tampered bytes', () => {
  const assetId = '77777777-7777-4777-8777-777777777777';
  const backup = createProjectBackupWithAssets(
    {
      project: { id: '11111111-1111-4111-8111-111111111111' },
      collections: {
        assets: [{ id: assetId, name: 'panel.png', mimeType: 'image/png', fileSize: 4 }],
      },
    },
    [{ id: assetId, name: 'panel.png', mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3, 4]) }],
  );
  backup.assets[0].contentBase64 = Buffer.from([9, 9, 9, 9]).toString('base64');
  const validation = validateProjectBackupWithAssets(backup);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /integrity hash does not match/);
});

test('project restore is disabled by default and requires explicit confirmation', () => {
  assert.equal(isFeatureEnabled('projectRestore', {}), false);
  assert.equal(isFeatureEnabled('projectRestore', { FEATURE_PROJECT_RESTORE: 'enabled' }), true);

  const confirmed = new Request('https://studio.example.test/api/db/projects/source/restore', {
    headers: { [RESTORE_CONFIRMATION_HEADER]: RESTORE_CONFIRMATION_VALUE },
  });
  assert.doesNotThrow(() => assertRestoreConfirmation(confirmed));
  assert.throws(
    () => assertRestoreConfirmation(new Request('https://studio.example.test')),
    ValidationError,
  );
});

test('restore planner remaps cross-entity IDs and preserves ownership in a new project', () => {
  const sourceProjectId = '11111111-1111-4111-8111-111111111111';
  const factionId = '22222222-2222-4222-8222-222222222222';
  const characterOneId = '33333333-3333-4333-8333-333333333333';
  const characterTwoId = '44444444-4444-4444-8444-444444444444';
  const locationId = '55555555-5555-4555-8555-555555555555';
  const timelineId = '66666666-6666-4666-8666-666666666666';
  const arcId = '77777777-7777-4777-8777-777777777777';
  const loreId = '88888888-8888-4888-8888-888888888888';
  const storyId = '99999999-9999-4999-8999-999999999999';
  const chapterId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const sceneDocumentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const sceneId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const assetId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const panelId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const backup = createProjectBackupWithAssets(
    {
      project: {
        id: sourceProjectId,
        name: 'Restorable Saga',
        themes: ['legacy'],
        prophecyHooks: [],
        publishingMetadata: {},
        version: 3,
      },
      collections: {
        factions: [{
          id: factionId,
          projectId: sourceProjectId,
          name: 'Guardians',
          allies: [factionId],
          enemies: [],
          canonStatus: 'canon',
          version: 2,
        }],
        characters: [
          {
            id: characterOneId,
            projectId: sourceProjectId,
            factionId,
            name: 'Kai',
            relationships: [{ character_id: characterTwoId, type: 'ally' }],
            status: 'alive',
            canonStatus: 'canon',
            version: 2,
          },
          {
            id: characterTwoId,
            projectId: sourceProjectId,
            factionId,
            name: 'Jax',
            relationships: [{ characterId: characterOneId, type: 'ally' }],
            status: 'alive',
            canonStatus: 'canon',
            version: 2,
          },
        ],
        locations: [{
          id: locationId,
          projectId: sourceProjectId,
          name: 'Nexus Gate',
          canonStatus: 'canon',
          version: 1,
        }],
        timelineEvents: [{
          id: timelineId,
          projectId: sourceProjectId,
          title: 'Convergence',
          affectedCharacters: [characterOneId],
          affectedFactions: [factionId],
          affectedLocations: [locationId],
          canonStatus: 'canon',
          version: 1,
        }],
        storyArcs: [{
          id: arcId,
          projectId: sourceProjectId,
          title: 'Memory Hero',
          type: 'hero',
          involvedCharacters: [characterOneId, characterTwoId],
          involvedFactions: [factionId],
          themes: ['memory'],
          turningPoints: ['awakening'],
          canonStatus: 'canon',
          version: 1,
        }],
        loreRules: [{
          id: loreId,
          projectId: sourceProjectId,
          title: 'Fusion Rule',
          appliesTo: [characterOneId],
          canonStatus: 'canon',
          version: 1,
        }],
        generatedStories: [{
          id: storyId,
          projectId: sourceProjectId,
          title: 'Opening',
          format: 'scene',
          content: 'The gate opens.',
          featuredCharacters: [characterOneId],
          featuredFactions: [factionId],
          featuredLocations: [locationId],
        }],
        writingDocuments: [
          {
            id: chapterId,
            projectId: sourceProjectId,
            parentId: null,
            title: 'Chapter One',
            kind: 'chapter',
            status: 'draft',
            content: 'Chapter text',
            order: 0,
            version: 1,
          },
          {
            id: sceneDocumentId,
            projectId: sourceProjectId,
            parentId: chapterId,
            title: 'Scene One',
            kind: 'scene',
            status: 'draft',
            content: 'Scene text',
            order: 0,
            version: 1,
          },
        ],
        scenes: [{
          id: sceneId,
          projectId: sourceProjectId,
          title: 'Gate Awakening',
          order: 1,
          locationId,
          canonStatus: 'canon',
          version: 1,
        }],
        assets: [{
          id: assetId,
          projectId: sourceProjectId,
          name: 'panel.png',
          fileSize: pngBytes.byteLength,
          mimeType: 'image/png',
          storageProvider: 'supabase',
        }],
        storyboardPanels: [{
          id: panelId,
          sceneId,
          panelNumber: 1,
          visualPrompt: 'A gate of light',
          actionDescription: 'The heroes arrive.',
          cameraShot: 'Wide Shot',
          assetId,
          version: 1,
        }],
      },
    },
    [{ id: assetId, name: 'panel.png', mimeType: 'image/png', bytes: pngBytes }],
  );

  const plan = buildProjectRestorePlan(backup, {
    userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    expectedSourceProjectId: sourceProjectId,
    idFactory: deterministicIdFactory(),
  });

  assert.notEqual(plan.targetProjectId, sourceProjectId);
  assert.equal(plan.project.ownerId, 'ffffffff-ffff-4fff-8fff-ffffffffffff');
  assert.equal(plan.project.name, 'Restorable Saga — Restored');
  assert.equal(plan.factions[0].projectId, plan.targetProjectId);
  assert.equal(plan.characters[0].factionId, plan.factions[0].id);
  assert.equal(plan.timelineEvents[0].affectedLocations?.[0], plan.locations[0].id);
  assert.equal(plan.storyArcs[0].involvedFactions?.[0], plan.factions[0].id);
  assert.equal(plan.writingDocuments[1].parentId, plan.writingDocuments[0].id);
  assert.equal(plan.scenes[0].locationId, plan.locations[0].id);
  assert.equal(plan.storyboardPanels[0].sceneId, plan.scenes[0].id);
  assert.equal(plan.storyboardPanels[0].assetId, plan.assets[0].id);
  assert.equal(plan.assetObjects[0].targetId, plan.assets[0].id);
  assert.equal(plan.assetObjects[0].extension, '.png');
  assert.equal(plan.entityCounts.characters, 2);

  const firstRelationships = plan.characters[0].relationships as Array<Record<string, unknown>>;
  const secondRelationships = plan.characters[1].relationships as Array<Record<string, unknown>>;
  assert.equal(firstRelationships[0].character_id, plan.characters[1].id);
  assert.equal(secondRelationships[0].characterId, plan.characters[0].id);
});

test('restore planner rejects references outside the backup package', () => {
  const sourceProjectId = '11111111-1111-4111-8111-111111111111';
  const characterId = '33333333-3333-4333-8333-333333333333';
  const backup = createProjectBackupWithAssets(
    {
      project: { id: sourceProjectId, name: 'Broken Restore' },
      collections: {
        assets: [],
        factions: [],
        characters: [{
          id: characterId,
          projectId: sourceProjectId,
          factionId: '22222222-2222-4222-8222-222222222222',
          name: 'Orphaned Hero',
          relationships: [],
        }],
      },
    },
    [],
  );

  assert.throws(
    () => buildProjectRestorePlan(backup, {
      userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      expectedSourceProjectId: sourceProjectId,
      idFactory: deterministicIdFactory(),
    }),
    ValidationError,
  );
});
