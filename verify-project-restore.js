/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
const STORAGE_ROOT = path.resolve(process.env.STORAGE_PATH || 'storage/uploads');

function requireTestConfiguration() {
  if (!DATABASE_URL) {
    throw new Error('Set TEST_DATABASE_URL, DATABASE_MIGRATION_URL, or DATABASE_URL before restore verification.');
  }
  if (/\.vercel\.app$|prod|production/i.test(new URL(BASE_URL).hostname) && process.env.ALLOW_REMOTE_TESTS !== 'true') {
    throw new Error('Refusing destructive restore verification against a remote/production-like host without ALLOW_REMOTE_TESTS=true.');
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

async function jsonResponse(response, label) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label} returned non-JSON status ${response.status}.`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${body.error || JSON.stringify(body)}`);
  }
  return body;
}

async function countFiles(root) {
  try {
    const entries = await fs.promises.readdir(root, { withFileTypes: true, recursive: true });
    return entries.filter((entry) => entry.isFile()).length;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

async function run() {
  requireTestConfiguration();
  const sql = postgres(DATABASE_URL, {
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : 'require',
    max: 1,
  });

  const suffix = randomUUID().slice(0, 8);
  const userId = randomUUID();
  const projectId = randomUUID();
  const sceneId = randomUUID();
  let sourceAssetId;
  let restoredProjectId;
  let restoredAssetId;
  const cleanupPaths = new Set();

  const jsonHeaders = () => ({
    'content-type': 'application/json',
    'x-test-session-user-id': userId,
  });

  try {
    await sql`
      insert into users (id, name, email, password_hash)
      values (${userId}, ${'Restore Verification User'}, ${`restore-${suffix}@example.test`}, ${'test-only-unused-hash'})
    `;

    const createProject = await fetch(`${BASE_URL}/api/db/projects`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        id: projectId,
        name: 'Transactional Restore Source',
        concept: 'Prove isolated recovery',
        themes: ['recovery'],
      }),
    });
    await jsonResponse(createProject, 'Project creation');

    const createScene = await fetch(`${BASE_URL}/api/db/projects/${projectId}/scenes`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ id: sceneId, title: 'Recovery Scene', summary: 'Restore this scene.', order: 1 }),
    });
    await jsonResponse(createScene, 'Scene creation');

    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const form = new FormData();
    form.set('projectId', projectId);
    form.set('file', new Blob([pngBytes], { type: 'image/png' }), 'restore-panel.png');
    const upload = await fetch(`${BASE_URL}/api/db/assets/upload`, {
      method: 'POST',
      headers: { 'x-test-session-user-id': userId },
      body: form,
    });
    const uploadBody = await jsonResponse(upload, 'Asset upload');
    sourceAssetId = uploadBody.data.id;

    const createPanel = await fetch(`${BASE_URL}/api/db/scenes/${sceneId}/storyboard`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        id: randomUUID(),
        panel_number: 1,
        visual_prompt: 'A restoration gate opens.',
        action_description: 'The recovered scene returns.',
        camera_shot: 'Wide Shot',
        asset_id: sourceAssetId,
      }),
    });
    await jsonResponse(createPanel, 'Storyboard panel creation');

    const backupResponse = await fetch(`${BASE_URL}/api/db/projects/${projectId}/backup?includeAssets=true`, {
      method: 'POST',
      headers: { 'x-test-session-user-id': userId },
    });
    const backupBody = await jsonResponse(backupResponse, 'Asset-byte backup');
    const backup = backupBody.data;
    if (backup.manifest.assetBytesIncluded !== true || backup.manifest.assetCount !== 1) {
      throw new Error('Asset-byte backup did not include the expected asset evidence.');
    }

    const restoreHeaders = {
      ...jsonHeaders(),
      'idempotency-key': `restore-${suffix}-transactional`,
      'x-restore-confirmation': 'RESTORE_AS_NEW_PROJECT',
    };
    const restoreResponse = await fetch(`${BASE_URL}/api/db/projects/${projectId}/restore`, {
      method: 'POST',
      headers: restoreHeaders,
      body: JSON.stringify(backup),
    });
    const restoreBody = await jsonResponse(restoreResponse, 'Transactional restore');
    restoredProjectId = restoreBody.data.restoredProjectId;
    if (!restoredProjectId || restoredProjectId === projectId) {
      throw new Error('Restore did not create a distinct target project.');
    }
    if (!restoreBody.data.lifecycleReceiptId) throw new Error('Restore did not return a lifecycle receipt.');

    const replayResponse = await fetch(`${BASE_URL}/api/db/projects/${projectId}/restore`, {
      method: 'POST',
      headers: restoreHeaders,
      body: JSON.stringify(backup),
    });
    const replayBody = await jsonResponse(replayResponse, 'Idempotent restore replay');
    if (replayResponse.headers.get('idempotency-replayed') !== 'true') {
      throw new Error('Restore replay was not identified as an idempotent replay.');
    }
    if (replayBody.data.restoredProjectId !== restoredProjectId) {
      throw new Error('Restore replay created or returned a different target project.');
    }

    const [restoredProject] = await sql`
      select id, owner_id, name from projects where id = ${restoredProjectId}
    `;
    if (!restoredProject || restoredProject.owner_id !== userId || !restoredProject.name.includes('Restored')) {
      throw new Error('Restored project ownership or naming evidence is invalid.');
    }

    const [restoredScene] = await sql`
      select id, project_id, title from scenes where project_id = ${restoredProjectId}
    `;
    if (!restoredScene || restoredScene.id === sceneId || restoredScene.title !== 'Recovery Scene') {
      throw new Error('Restored scene was not remapped correctly.');
    }

    const [restoredAsset] = await sql`
      select id, owner_id, project_id, file_path, storage_provider from assets where project_id = ${restoredProjectId}
    `;
    if (!restoredAsset || restoredAsset.id === sourceAssetId || restoredAsset.owner_id !== userId) {
      throw new Error('Restored asset identity or ownership is invalid.');
    }
    restoredAssetId = restoredAsset.id;

    const [restoredPanel] = await sql`
      select scene_id, asset_id from storyboard_panels where scene_id = ${restoredScene.id}
    `;
    if (!restoredPanel || restoredPanel.asset_id !== restoredAssetId) {
      throw new Error('Restored storyboard panel does not reference the remapped asset.');
    }

    const [receipt] = await sql`
      select operation, status, project_id from data_lifecycle_events
      where project_id = ${restoredProjectId} and operation = 'project_restore'
      order by created_at desc limit 1
    `;
    if (!receipt || receipt.status !== 'completed') {
      throw new Error('Durable project restore lifecycle receipt was not recorded.');
    }

    const servedAsset = await fetch(`${BASE_URL}/api/db/assets/${restoredAssetId}/serve`, {
      headers: { 'x-test-session-user-id': userId },
    });
    if (!servedAsset.ok) throw new Error(`Restored asset serving failed with ${servedAsset.status}.`);
    const servedBytes = new Uint8Array(await servedAsset.arrayBuffer());
    if (Buffer.compare(Buffer.from(servedBytes), Buffer.from(pngBytes)) !== 0) {
      throw new Error('Restored asset bytes do not match the source asset.');
    }

    const fileCountBeforeFailure = await countFiles(STORAGE_ROOT);
    const failingBackup = structuredClone(backup);
    failingBackup.payload.project.name = 'X'.repeat(300);
    failingBackup.manifest.payloadSha256 = sha256(failingBackup.payload);
    const failedRestore = await fetch(`${BASE_URL}/api/db/projects/${projectId}/restore`, {
      method: 'POST',
      headers: {
        ...jsonHeaders(),
        'idempotency-key': `restore-${suffix}-rollback`,
        'x-restore-confirmation': 'RESTORE_AS_NEW_PROJECT',
      },
      body: JSON.stringify(failingBackup),
    });
    if (failedRestore.ok) throw new Error('Expected the oversized-name restore to fail.');
    const fileCountAfterFailure = await countFiles(STORAGE_ROOT);
    if (fileCountAfterFailure !== fileCountBeforeFailure) {
      throw new Error(`Compensating storage cleanup failed: before=${fileCountBeforeFailure}, after=${fileCountAfterFailure}.`);
    }

    const projectCount = await sql`
      select count(*)::int as count from projects where owner_id = ${userId}
    `;
    if (projectCount[0].count !== 2) {
      throw new Error(`Failed restore left unexpected project rows; found ${projectCount[0].count}.`);
    }

    console.log('✅ Asset-byte backup and isolated restore verified.');
    console.log('✅ Cross-entity IDs, ownership, storage bytes, and lifecycle receipt verified.');
    console.log('✅ Idempotent replay and compensating storage cleanup verified.');
  } finally {
    const assetRows = await sql`
      select id, file_path from assets where owner_id = ${userId}
    `.catch(() => []);
    for (const row of assetRows) {
      cleanupPaths.add(path.resolve(STORAGE_ROOT, row.file_path));
      await fetch(`${BASE_URL}/api/db/assets/${row.id}`, {
        method: 'DELETE',
        headers: { 'x-test-session-user-id': userId },
      }).catch(() => undefined);
    }

    await sql`delete from projects where owner_id = ${userId}`.catch(() => undefined);
    await sql`delete from users where id = ${userId}`.catch(() => undefined);
    for (const filePath of cleanupPaths) {
      await fs.promises.rm(filePath, { force: true }).catch(() => undefined);
    }
    await sql.end({ timeout: 5 });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : 'Project restore verification failed.');
  process.exitCode = 1;
});
