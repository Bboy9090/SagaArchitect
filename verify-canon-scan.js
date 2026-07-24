/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

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
  const email = `canon-scan-${suffix}@example.test`;
  let userId;
  const projectId = randomUUID();
  const characterId = randomUUID();
  const scene1 = randomUUID();
  const scene2 = randomUUID();
  const panel1 = randomUUID();
  const panel2 = randomUUID();
  const assetId = randomUUID();
  const missingCharacterId = randomUUID();
  const lore1 = randomUUID();
  const lore2 = randomUUID();

  try {
    const registration = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Canon Verification User', email, password: 'Canon-Test-Password-123!' }),
    });
    const registrationData = await registration.json();
    if (registration.status !== 201) throw new Error(`Registration failed with ${registration.status}.`);
    userId = registrationData.data.id;

    console.log('Seeding logically inconsistent project data for canon scan verification...');
    await sql.begin(async (tx) => {
      await tx`insert into projects (id, owner_id, name, concept, version)
               values (${projectId}, ${userId}, 'Canon Verification Project', 'Deterministic scan tests', 1)`;
      await tx`insert into characters (id, project_id, name, role)
               values (${characterId}, ${projectId}, '   ', 'Empty Role')`;
      await tx`insert into scenes (id, project_id, title, "order")
               values (${scene1}, ${projectId}, 'Scene A', 1), (${scene2}, ${projectId}, 'Scene B', 1)`;
      await tx`insert into storyboard_panels (id, scene_id, panel_number, visual_prompt, action_description, camera_shot)
               values (${panel1}, ${scene1}, 5, 'Shot 1', 'Action 1', 'Close Up'),
                      (${panel2}, ${scene1}, 5, 'Shot 2', 'Action 2', 'Close Up')`;
      await tx`insert into assets (id, owner_id, project_id, name, file_path, file_size, mime_type, storage_provider)
               values (${assetId}, ${userId}, ${projectId}, 'missing-local-image.jpg', ${path.join(process.cwd(), 'storage', 'uploads', `missing-${assetId}.jpg`)}, 1234, 'image/jpeg', 'local')`;
      await tx`update storyboard_panels set asset_id = ${assetId} where id = ${panel2}`;
      await tx`insert into timeline_events (project_id, title, affected_characters)
               values (${projectId}, 'Event with missing character', array[${missingCharacterId}]::uuid[])`;
      await tx`insert into lore_rules (id, project_id, title, description)
               values (${lore1}, ${projectId}, 'Magic Law', 'First definition'),
                      (${lore2}, ${projectId}, 'Magic Law', 'Conflicting definition')`;
    });

    const response = await fetch(`${BASE_URL}/api/db/projects/${projectId}/scan-canon`, {
      headers: { 'x-test-session-user-id': userId },
    });
    const body = await response.json();
    if (response.status !== 200 || !body.ok) throw new Error(`Canon scan failed with ${response.status}.`);

    const categories = new Set(body.data.issues.map((issue) => issue.category));
    const expected = [
      'empty_required_field',
      'duplicate_scene_order',
      'duplicate_storyboard_panel_number',
      'missing_local_asset_file',
      'missing_character_reference',
      'conflicting_lore_definition',
    ];
    for (const category of expected) {
      if (!categories.has(category)) throw new Error(`Expected canon issue category missing: ${category}`);
      console.log(`✅ Canon issue category detected: ${category}`);
    }

    console.log(`🎉 Canon scan verification passed with ${body.data.totalIssues} reported issues.`);
  } finally {
    await sql`delete from projects where id = ${projectId}`;
    if (userId) await sql`delete from users where id = ${userId}`;
    await sql.end({ timeout: 5 });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Canon scan verification failed.');
  process.exitCode = 1;
});
