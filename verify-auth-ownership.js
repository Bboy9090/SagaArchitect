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

async function request(path, init = {}) {
  return fetch(`${BASE_URL}${path}`, init);
}

function testHeaders(userId, extra = {}) {
  return { ...extra, 'x-test-session-user-id': userId };
}

function assertStatus(actual, expected, label) {
  if (!expected.includes(actual)) {
    throw new Error(`${label}: expected ${expected.join(' or ')}, received ${actual}`);
  }
  console.log(`✅ ${label}: ${actual}`);
}

async function run() {
  requireTestConfiguration();
  const sql = postgres(DATABASE_URL, {
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : 'require',
    max: 1,
  });

  const suffix = randomUUID().slice(0, 8);
  const emailA = `enterprise-user-a-${suffix}@example.test`;
  const emailB = `enterprise-user-b-${suffix}@example.test`;
  const projectId = randomUUID();
  let userAId;
  let userBId;

  console.log(`Running authentication and ownership verification against ${BASE_URL}...`);

  try {
    const regARes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Enterprise User A', email: emailA, password: 'Test-Password-A-123!' }),
    });
    const regA = await regARes.json();
    assertStatus(regARes.status, [201], 'User A registration');
    userAId = regA.data.id;

    const regBRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Enterprise User B', email: emailB, password: 'Test-Password-B-123!' }),
    });
    const regB = await regBRes.json();
    assertStatus(regBRes.status, [201], 'User B registration');
    userBId = regB.data.id;

    const createRes = await request('/api/db/projects', {
      method: 'POST',
      headers: testHeaders(userAId, { 'content-type': 'application/json' }),
      body: JSON.stringify({ id: projectId, name: "User A's Isolated Project" }),
    });
    assertStatus(createRes.status, [201], 'User A project creation');

    assertStatus((await request(`/api/db/projects/${projectId}`, { headers: testHeaders(userAId) })).status, [200], 'Owner project read');

    const listBRes = await request('/api/db/projects', { headers: testHeaders(userBId) });
    assertStatus(listBRes.status, [200], 'User B project list');
    const listB = await listBRes.json();
    if ((listB.data || []).some((project) => project.id === projectId)) {
      throw new Error("Ownership isolation failed: User B's list contains User A's project.");
    }
    console.log('✅ User B cannot list User A project');

    assertStatus((await request(`/api/db/projects/${projectId}`, { headers: testHeaders(userBId) })).status, [403], 'Non-owner project read blocked');
    assertStatus((await request(`/api/db/projects/${projectId}`, {
      method: 'PUT',
      headers: testHeaders(userBId, { 'content-type': 'application/json' }),
      body: JSON.stringify({ name: 'Unauthorized update' }),
    })).status, [403], 'Non-owner project update blocked');
    assertStatus((await request(`/api/db/projects/${projectId}`, { method: 'DELETE', headers: testHeaders(userBId) })).status, [403], 'Non-owner project delete blocked');
    assertStatus((await request(`/api/db/projects/${projectId}/characters`, { headers: testHeaders(userBId) })).status, [403], 'Non-owner character access blocked');
    assertStatus((await request(`/api/db/projects/${projectId}/scenes`, { headers: testHeaders(userBId) })).status, [403], 'Non-owner scene access blocked');
    assertStatus((await request(`/api/db/projects/${projectId}/assets`, { headers: testHeaders(userBId) })).status, [403], 'Non-owner asset access blocked');
    assertStatus((await request(`/api/db/projects/${projectId}/export/pdf`, { method: 'POST', headers: testHeaders(userBId) })).status, [403], 'Non-owner PDF export blocked');
    assertStatus((await request(`/api/db/projects/${projectId}/export/json`, { headers: testHeaders(userBId) })).status, [403], 'Non-owner JSON export blocked');
    assertStatus((await request(`/api/db/projects/${projectId}/history`, { headers: testHeaders(userBId) })).status, [403], 'Non-owner history access blocked');
    assertStatus((await request(`/api/db/projects/${projectId}/scan-canon`, { headers: testHeaders(userBId) })).status, [403], 'Non-owner canon scan blocked');
    assertStatus((await request(`/api/db/projects/${projectId}`)).status, [401], 'Unauthenticated project access blocked');

    console.log('🎉 Authentication and ownership verification passed.');
  } finally {
    await sql`delete from projects where id = ${projectId}`;
    if (userAId) await sql`delete from users where id = ${userAId}`;
    if (userBId) await sql`delete from users where id = ${userBId}`;
    await sql.end({ timeout: 5 });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Authentication verification failed.');
  process.exitCode = 1;
});
