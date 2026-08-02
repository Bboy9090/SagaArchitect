import fs from 'node:fs';
import postgres from 'postgres';

const EVIDENCE_PATH = 'staging-cleanup-evidence.json';
const required = (key) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

if (required('APP_ENV').toLowerCase() !== 'staging') {
  throw new Error('Staging cleanup requires APP_ENV=staging.');
}
if (process.env.STAGING_CONFIRM_ISOLATED !== 'true' || process.env.ALLOW_REMOTE_TESTS !== 'true') {
  throw new Error('Staging cleanup requires explicit isolation and remote-test approval.');
}

const databaseUrl = required('DATABASE_MIGRATION_URL');
const supabaseUrl = new URL(required('SUPABASE_URL'));
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const bucket = required('SUPABASE_STORAGE_BUCKET');
const sql = postgres(databaseUrl, { ssl: 'require', max: 1 });
const startedAt = Date.now();
const receipt = {
  ok: false,
  startedAt: new Date(startedAt).toISOString(),
  matchedUsers: 0,
  matchedAssets: 0,
  deletedObjects: 0,
  missingObjects: 0,
  deletedUsers: 0,
  remainingUsers: 0,
};

function headers() {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
  };
}

function objectUrl(key) {
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl.toString().replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`;
}

try {
  const users = await sql`
    select id, email
    from users
    where email like 'pcs-staging-%@example.test'
       or email like 'pcs-browser-%@example.test'
  `;
  receipt.matchedUsers = users.length;
  const userIds = users.map((user) => user.id);

  if (userIds.length) {
    const assets = await sql`
      select id, file_path, storage_provider
      from assets
      where owner_id = any(${userIds}::uuid[])
    `;
    receipt.matchedAssets = assets.length;

    for (const asset of assets) {
      if (asset.storage_provider !== 'supabase') {
        throw new Error(`Unexpected staging storage provider for asset ${asset.id}: ${asset.storage_provider}.`);
      }
      const response = await fetch(objectUrl(asset.file_path), {
        method: 'DELETE',
        headers: headers(),
      });
      if ([200, 204].includes(response.status)) receipt.deletedObjects += 1;
      else if ([400, 404].includes(response.status)) receipt.missingObjects += 1;
      else throw new Error(`Supabase cleanup failed for asset ${asset.id} with ${response.status}.`);
    }

    const deleted = await sql`
      delete from users where id = any(${userIds}::uuid[]) returning id
    `;
    receipt.deletedUsers = deleted.length;
  }

  const remaining = await sql`
    select count(*)::int as count
    from users
    where email like 'pcs-staging-%@example.test'
       or email like 'pcs-browser-%@example.test'
  `;
  receipt.remainingUsers = remaining[0].count;
  if (receipt.remainingUsers !== 0) throw new Error('Staging acceptance users remain after cleanup.');
  receipt.ok = true;
} finally {
  await sql.end({ timeout: 5 });
  receipt.completedAt = new Date().toISOString();
  receipt.durationMs = Date.now() - startedAt;
  const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
  fs.writeFileSync(EVIDENCE_PATH, serialized, 'utf8');
  console.log(serialized.trimEnd());
}

if (!receipt.ok) process.exitCode = 1;
