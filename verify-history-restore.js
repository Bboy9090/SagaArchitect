/* eslint-disable @typescript-eslint/no-require-imports */
async function run() {
  const pg = require('C:/Users/Bobby/pgtemp/node_modules/pg');
  const clientUrl = 'postgresql://postgres.yfbkkjbtwpgatjlsjeab:Kai-Jax0990@aws-1-us-east-1.pooler.supabase.com:6543/postgres';
  const client = new pg.Client({ connectionString: clientUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Seeding project and scene for history restore verification...');

  const projectId = '33333333-3333-3333-3333-333333333333';
  const devUser = '11111111-1111-4111-8111-111111111111';

  // Seed project
  await client.query(`
    INSERT INTO projects (id, owner_id, name, concept, version)
    VALUES ($1, $2, 'History Restore Project', 'Reverting actions', 1)
    ON CONFLICT (id) DO NOTHING
  `, [projectId, devUser]);

  // Create scene initially
  const sceneId = '99999999-9999-9999-9999-999999999991';
  console.log('1. Creating scene...');
  const createRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sceneId, title: 'Original Scene Title', order: 1 })
  });
  console.log('   Create status:', createRes.status);

  // Update scene to trigger an update version_history entry
  console.log('2. Updating scene title...');
  const updateRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sceneId, title: 'Updated Scene Title', order: 1 })
  });
  console.log('   Update status:', updateRes.status);

  // Fetch the version history entries for the project
  const historyRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/history`);
  const historyData = await historyRes.json();
  const historyList = historyData.data || [];
  console.log('   History count:', historyList.length);

  // Find the 'update:scene' entry that represents the scene before the update.
  // Wait! In Scenes POST: when it exists, we run tx.update and logVersion with `action: 'update'`.
  // The logVersion changeData contains the new updated values.
  // Let's find that update entry.
  const updateEntry = historyList.find(h => h.action === 'update' && h.entity_type === 'scene');
  const createEntry = historyList.find(h => h.action === 'create' && h.entity_type === 'scene');

  if (!updateEntry || !createEntry) {
    console.error('❌ Expected version history entries missing!');
    process.exit(1);
  }

  // To revert back to 'Original Scene Title', we can restore to the 'create' entry which contains 'Original Scene Title' in its changeData snapshot!
  console.log('3. Restoring to the create entry (Original Title)...', createEntry.id);
  const restoreRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/history/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ historyId: createEntry.id })
  });

  const restoreData = await restoreRes.json();
  console.log('   Restore HTTP Status:', restoreRes.status);
  console.log('   Restore Response:', JSON.stringify(restoreData));

  // Connect to database and verify title is reverted
  const scenes = await client.query('SELECT * FROM scenes WHERE id = $1', [sceneId]);
  const scene = scenes.rows[0];
  console.log('Scene in database after restore:', {
    id: scene.id,
    title: scene.title,
    version: scene.version
  });

  let ok = true;
  if (scene.title === 'Original Scene Title') {
    console.log('✅ Asserted title successfully reverted to "Original Scene Title"!');
  } else {
    console.error(`❌ Expected title to be "Original Scene Title" but got "${scene.title}"!`);
    ok = false;
  }

  // Verify project JSON export route works too!
  console.log('4. Verifying JSON export route...');
  const jsonExportRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/export/json`);
  console.log('   JSON export HTTP Status:', jsonExportRes.status);
  const exportDataset = await jsonExportRes.json();
  if (jsonExportRes.ok && exportDataset.project) {
    console.log('✅ JSON export verified successfully!');
  } else {
    console.error('❌ JSON export route failed!');
    ok = false;
  }

  // Cleanup
  console.log('Cleaning up test data...');
  await client.query('DELETE FROM projects WHERE id = $1', [projectId]);
  await client.end();

  if (ok) {
    console.log('🎉 All Phase 2G restore/export tests passed successfully!');
  } else {
    console.error('❌ Verification failed assertions!');
    process.exit(1);
  }
}

run().catch(console.error);
