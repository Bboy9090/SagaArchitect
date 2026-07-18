/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
async function run() {
  const pg = require('C:/Users/Bobby/pgtemp/node_modules/pg');
  const clientUrl = 'postgresql://postgres.yfbkkjbtwpgatjlsjeab:Kai-Jax0990@aws-1-us-east-1.pooler.supabase.com:6543/postgres';
  const client = new pg.Client({ connectionString: clientUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Seeding logically inconsistent project data for scan verification...');

  const projectId = '22222222-2222-2222-2222-222222222222';
  const devUser = '11111111-1111-4111-8111-111111111111';

  // Seed project
  await client.query(`
    INSERT INTO projects (id, owner_id, name, concept, version)
    VALUES ($1, $2, 'Verify Canon Project', 'Deterministic scan tests', 1)
    ON CONFLICT (id) DO NOTHING
  `, [projectId, devUser]);

  // A. Empty character name (whitespace)
  const charId = '33333333-3333-3333-3333-333333333333';
  await client.query(`
    INSERT INTO characters (id, project_id, name, role)
    VALUES ($1, $2, '   ', 'Empty Role')
    ON CONFLICT (id) DO NOTHING
  `, [charId, projectId]);

  // B. Duplicate scene ordering (order = 1)
  const scene1 = '44444444-4444-4444-4444-444444444441';
  const scene2 = '44444444-4444-4444-4444-444444444442';
  await client.query(`
    INSERT INTO scenes (id, project_id, title, "order")
    VALUES ($1, $2, 'Scene A', 1)
    ON CONFLICT (id) DO NOTHING
  `, [scene1, projectId]);
  await client.query(`
    INSERT INTO scenes (id, project_id, title, "order")
    VALUES ($1, $2, 'Scene B', 1)
    ON CONFLICT (id) DO NOTHING
  `, [scene2, projectId]);

  // C. Duplicate storyboard panel numbers (number = 5)
  const panel1 = '55555555-5555-5555-5555-555555555551';
  const panel2 = '55555555-5555-5555-5555-555555555552';
  const badAssetId = '99999999-9999-9999-9999-999999999999'; // broken asset ref

  await client.query(`
    INSERT INTO storyboard_panels (id, scene_id, panel_number, visual_prompt, action_description, camera_shot)
    VALUES ($1, $2, 5, 'Shot 1', 'Action 1', 'Close Up')
    ON CONFLICT (id) DO NOTHING
  `, [panel1, scene1]);
  await client.query(`
    INSERT INTO storyboard_panels (id, scene_id, panel_number, visual_prompt, action_description, camera_shot, asset_id)
    VALUES ($1, $2, 5, 'Shot 2', 'Action 2', 'Close Up', $3)
    ON CONFLICT (id) DO NOTHING
  `, [panel2, scene1, null]); // We set asset_id to null here to prevent FK error, we can test asset_id being set to a non-existent asset, but wait! PostgreSQL would reject a non-existent asset_id FK constraint!
  // So to test missing file for a local asset, we seed a VALID asset row but with a file path that doesn't exist.
  const validAssetId = '77777777-7777-7777-7777-777777777777';
  await client.query(`
    INSERT INTO assets (id, owner_id, project_id, name, file_path, file_size, mime_type, storage_provider)
    VALUES ($1, $2, $3, 'ghost-image.jpg', 'C:/phoenix/storage/uploads/non-existent-ghost-image.jpg', 1234, 'image/jpeg', 'local')
    ON CONFLICT (id) DO NOTHING
  `, [validAssetId, devUser, projectId]);

  // Now we update panel2 to point to validAssetId
  await client.query(`
    UPDATE storyboard_panels SET asset_id = $1 WHERE id = $2
  `, [validAssetId, panel2]);

  // D. Missing character reference in timeline_events
  const missingCharId = '88888888-8888-8888-8888-888888888888';
  await client.query(`
    INSERT INTO timeline_events (project_id, title, affected_characters)
    VALUES ($1, 'Event with missing char', ARRAY[$2]::uuid[])
  `, [projectId, missingCharId]);

  // E. Conflicting lore definition (same title, different desc)
  const lore1 = '66666666-6666-6666-6666-666666666661';
  const lore2 = '66666666-6666-6666-6666-666666666662';
  await client.query(`
    INSERT INTO lore_rules (id, project_id, title, description)
    VALUES ($1, $2, 'Magic Law', 'First definition of magic rules')
    ON CONFLICT (id) DO NOTHING
  `, [lore1, projectId]);
  await client.query(`
    INSERT INTO lore_rules (id, project_id, title, description)
    VALUES ($1, $2, 'Magic Law', 'Conflicting definition of magic rules')
    ON CONFLICT (id) DO NOTHING
  `, [lore2, projectId]);

  console.log('Seed completed. Requesting Canon Scan from API...');

  const res = await fetch(`http://localhost:3000/api/db/projects/${projectId}/scan-canon`);
  const data = await res.json();

  console.log('HTTP Status:', res.status);
  if (!res.ok || !data.ok) {
    console.error('Scan API failed!', JSON.stringify(data));
    process.exit(1);
  }

  const result = data.data;
  console.log('Total issues found:', result.totalIssues);
  console.log('Counts by severity:', JSON.stringify(result.countsBySeverity));
  console.log('Counts by category:', JSON.stringify(result.countsByCategory));

  const categories = result.issues.map(i => i.category);

  const assertions = [
    { cat: 'empty_required_field', desc: 'Empty required field' },
    { cat: 'duplicate_scene_order', desc: 'Duplicate scene ordering' },
    { cat: 'duplicate_storyboard_panel_number', desc: 'Duplicate storyboard panel number' },
    { cat: 'missing_local_asset_file', desc: 'Missing local asset file' },
    { cat: 'missing_character_reference', desc: 'Missing character reference' },
    { cat: 'conflicting_lore_definition', desc: 'Conflicting lore definition' }
  ];

  let ok = true;
  assertions.forEach(a => {
    if (categories.includes(a.cat)) {
      console.log(`✅ Asserted issue category found: ${a.cat} (${a.desc})`);
    } else {
      console.error(`❌ Expected issue category missing: ${a.cat} (${a.desc})`);
      ok = false;
    }
  });

  console.log('Cleaning up seeded test data...');
  await client.query('DELETE FROM projects WHERE id = $1', [projectId]);
  await client.end();

  if (ok) {
    console.log('🎉 Verification passed successfully!');
  } else {
    console.error('❌ Verification failed assertions!');
    process.exit(1);
  }
}

run().catch(console.error);
