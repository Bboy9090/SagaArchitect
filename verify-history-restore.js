/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const { randomUUID } = require('node:crypto');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;

function requireTestConfiguration() {
  if (!DATABASE_URL) {
    throw new Error('Set TEST_DATABASE_URL (preferred), DATABASE_MIGRATION_URL, or DATABASE_URL before running this verification.');
  }
  if (/\.vercel\.app$|prod|production/i.test(new URL(BASE_URL).hostname) && process.env.ALLOW_REMOTE_TESTS !== 'true') {
    throw new Error('Refusing to run destructive verification against a remote/production-like host without ALLOW_REMOTE_TESTS=true.');
  }
}

async function run() {
  requireTestConfiguration();
  const sql = postgres(DATABASE_URL, {
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : 'require',
    max: 1,
  });

  const suffix = randomUUID().slice(0, 8);
  const email = `history-restore-${suffix}@example.test`;
  const projectId = randomUUID();
  const sceneId = randomUUID();
  let userId;

  const headers = () => ({
    'content-type': 'application/json',
    'x-test-session-user-id': userId,
  });

  try {
    const registration = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'History Verification User', email, password: 'History-Test-Password-123!' }),
    });
    const registrationData = await registration.json();
    if (registration.status !== 201) throw new Error(`Registration failed with ${registration.status}.`);
    userId = registrationData.data.id;

    const createProject = await fetch(`${BASE_URL}/api/db/projects`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ id: projectId, name: 'History Restore Project', concept: 'Reverting actions' }),
    });
    if (createProject.status !== 201) throw new Error(`Project creation failed with ${createProject.status}.`);

    const createScene = await fetch(`${BASE_URL}/api/db/projects/${projectId}/scenes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ id: sceneId, title: 'Original Scene Title', order: 1 }),
    });
    if (!createScene.ok) throw new Error(`Scene creation failed with ${createScene.status}.`);

    const updateScene = await fetch(`${BASE_URL}/api/db/projects/${projectId}/scenes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ id: sceneId, title: 'Updated Scene Title', order: 1 }),
    });
    if (!updateScene.ok) throw new Error(`Scene update failed with ${updateScene.status}.`);

    const historyResponse = await fetch(`${BASE_URL}/api/db/projects/${projectId}/history`, {
      headers: { 'x-test-session-user-id': userId },
    });
    const historyBody = await historyResponse.json();
    if (!historyResponse.ok) throw new Error(`History request failed with ${historyResponse.status}.`);

    const createEntry = (historyBody.data || []).find((entry) => entry.action === 'create' && entry.entity_type === 'scene');
    if (!createEntry) throw new Error('Expected scene creation history entry was not found.');

    const restoreResponse = await fetch(`${BASE_URL}/api/db/projects/${projectId}/history/restore`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ historyId: createEntry.id }),
    });
    if (!restoreResponse.ok) throw new Error(`History restore failed with ${restoreResponse.status}.`);

    const [scene] = await sql`select id, title, version from scenes where id = ${sceneId}`;
    if (!scene || scene.title !== 'Original Scene Title') {
      throw new Error(`History restore did not restore the expected title; received ${scene?.title || '(missing)'}.`);
    }
    console.log('✅ Scene title restored from version history.');

    const exportResponse = await fetch(`${BASE_URL}/api/db/projects/${projectId}/export/json`, {
      headers: { 'x-test-session-user-id': userId },
    });
    if (!exportResponse.ok) throw new Error(`JSON export failed with ${exportResponse.status}.`);
    const exportBody = await exportResponse.json();
    if (!exportBody.project) throw new Error('JSON export did not contain project data.');
    console.log('✅ JSON export verified after restore.');

    console.log('🎉 History restore verification passed.');
  } finally {
    await sql`delete from projects where id = ${projectId}`;
    if (userId) await sql`delete from users where id = ${userId}`;
    await sql.end({ timeout: 5 });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'History restore verification failed.');
  process.exitCode = 1;
});
