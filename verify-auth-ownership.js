/* eslint-disable @typescript-eslint/no-require-imports */
async function run() {
  const pg = require('C:/Users/Bobby/pgtemp/node_modules/pg');
  const clientUrl = 'postgresql://postgres.yfbkkjbtwpgatjlsjeab:Kai-Jax0990@aws-1-us-east-1.pooler.supabase.com:6543/postgres';
  const client = new pg.Client({ connectionString: clientUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Running Authentication and Ownership Verification Suite...');

  // 1. Register User A
  console.log('Registering User A...');
  const regARes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User A', email: 'user_a@saga.com', password: 'passwordA123' })
  });
  const regAData = await regARes.json();
  const userAId = regAData.data.id;
  console.log('   User A registered:', userAId);

  // 2. Register User B
  console.log('Registering User B...');
  const regBRes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User B', email: 'user_b@saga.com', password: 'passwordB123' })
  });
  const regBData = await regBRes.json();
  const userBId = regBData.data.id;
  console.log('   User B registered:', userBId);

  let passed = true;

  // 3. User A creates a project
  const projectId = '77777777-7777-7777-7777-777777777777';
  console.log('User A creating project...');
  const createRes = await fetch('http://localhost:3000/api/db/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-session-user-id': userAId
    },
    body: JSON.stringify({ id: projectId, name: "User A's Secret Novel" })
  });
  console.log('   Create status:', createRes.status);
  if (createRes.status !== 200) {
    passed = false;
    console.error('❌ User A failed to create project');
  }

  // 4. Confirm User A can read it
  console.log('User A reading project details...');
  const readARes = await fetch(`http://localhost:3000/api/db/projects/${projectId}`, {
    headers: { 'x-test-session-user-id': userAId }
  });
  console.log('   User A read status:', readARes.status);
  if (readARes.status !== 200) {
    passed = false;
    console.error('❌ User A failed to read their own project');
  }

  // 5. Confirm User B cannot list User A's project
  console.log('User B listing projects...');
  const listBRes = await fetch('http://localhost:3000/api/db/projects', {
    headers: { 'x-test-session-user-id': userBId }
  });
  const listBData = await listBRes.json();
  const foundAInList = (listBData.data || []).some(p => p.id === projectId);
  if (foundAInList) {
    passed = false;
    console.error('❌ Security breach: User B saw User A\'s project in project list');
  } else {
    console.log('✅ Asserted: User B cannot list User A\'s project');
  }

  // 6. Confirm User B cannot fetch User A's project directly (should get 403)
  console.log('User B attempting to read User A\'s project...');
  const readBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}`, {
    headers: { 'x-test-session-user-id': userBId }
  });
  console.log('   User B read status:', readBRes.status);
  if (readBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B was able to read User A\'s project');
  } else {
    console.log('✅ Asserted: User B blocked from reading User A\'s project with status:', readBRes.status);
  }

  // 7. Confirm User B cannot update it
  console.log('User B attempting to update User A\'s project...');
  const updateBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-test-session-user-id': userBId
    },
    body: JSON.stringify({ name: "Hacked!" })
  });
  console.log('   User B update status:', updateBRes.status);
  if (updateBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B was able to update User A\'s project');
  } else {
    console.log('✅ Asserted: User B blocked from updating User A\'s project with status:', updateBRes.status);
  }

  // 8. Confirm User B cannot delete it
  console.log('User B attempting to delete User A\'s project...');
  const deleteBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}`, {
    method: 'DELETE',
    headers: { 'x-test-session-user-id': userBId }
  });
  console.log('   User B delete status:', deleteBRes.status);
  if (deleteBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B was able to delete User A\'s project');
  } else {
    console.log('✅ Asserted: User B blocked from deleting User A\'s project with status:', deleteBRes.status);
  }

  // 9. Confirm User B cannot access child entities under it (characters list, scenes list)
  console.log('User B attempting characters list...');
  const charsBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/characters`, {
    headers: { 'x-test-session-user-id': userBId }
  });
  console.log('   User B characters list status:', charsBRes.status);
  if (charsBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B accessed User A\'s characters list');
  } else {
    console.log('✅ Asserted: User B blocked from characters list with status:', charsBRes.status);
  }

  // 10. Confirm User B cannot access assets list
  console.log('User B attempting assets list...');
  const assetsBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/assets`, {
    headers: { 'x-test-session-user-id': userBId }
  });
  console.log('   User B assets list status:', assetsBRes.status);
  if (assetsBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B accessed User A\'s assets list');
  } else {
    console.log('✅ Asserted: User B blocked from assets list with status:', assetsBRes.status);
  }

  // 11. Confirm User B cannot access PDF export
  console.log('User B attempting PDF export...');
  const pdfBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/export/pdf`, {
    method: 'POST',
    headers: { 'x-test-session-user-id': userBId }
  });
  console.log('   User B PDF export status:', pdfBRes.status);
  if (pdfBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B was able to export User A\'s project to PDF');
  } else {
    console.log('✅ Asserted: User B blocked from PDF export with status:', pdfBRes.status);
  }

  // 12. Confirm User B cannot access JSON export
  console.log('User B attempting JSON export...');
  const jsonBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/export/json`, {
    headers: { 'x-test-session-user-id': userBId }
  });
  console.log('   User B JSON export status:', jsonBRes.status);
  if (jsonBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B was able to export User A\'s project to JSON');
  } else {
    console.log('✅ Asserted: User B blocked from JSON export with status:', jsonBRes.status);
  }

  // 13. Confirm User B cannot access history logs
  console.log('User B attempting history GET...');
  const histBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/history`, {
    headers: { 'x-test-session-user-id': userBId }
  });
  console.log('   User B history status:', histBRes.status);
  if (histBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B accessed User A\'s history logs');
  } else {
    console.log('✅ Asserted: User B blocked from history logs with status:', histBRes.status);
  }

  // 14. Confirm User B cannot run canon scan
  console.log('User B attempting canon scan...');
  const scanBRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}/scan-canon`, {
    headers: { 'x-test-session-user-id': userBId }
  });
  console.log('   User B canon scan status:', scanBRes.status);
  if (scanBRes.status === 200) {
    passed = false;
    console.error('❌ Security breach: User B was able to run canon scan on User A\'s project');
  } else {
    console.log('✅ Asserted: User B blocked from canon scan with status:', scanBRes.status);
  }

  // 15. Confirm unauthenticated requests return 401
  console.log('Unauthenticated request to project GET...');
  const unauthRes = await fetch(`http://localhost:3000/api/db/projects/${projectId}`);
  console.log('   Unauthenticated GET status:', unauthRes.status);
  if (unauthRes.status !== 401) {
    passed = false;
    console.error('❌ Expected 401 Unauthorized for missing session, got:', unauthRes.status);
  } else {
    console.log('✅ Asserted: Unauthenticated request returned 401 Unauthorized');
  }

  // Cleanup
  console.log('Cleaning up users and project records...');
  await client.query('DELETE FROM projects WHERE id = $1', [projectId]);
  await client.query('DELETE FROM users WHERE id IN ($1, $2)', [userAId, userBId]);
  await client.end();

  if (passed) {
    console.log('🎉 All authentication and ownership checks verified successfully!');
  } else {
    console.error('❌ Verification failed assertions!');
    process.exit(1);
  }
}

run().catch(console.error);
