import fs from 'node:fs';
import { stagingAutomationPost } from './lib/staging-automation-client.mjs';

const EVIDENCE_PATH = 'staging-cleanup-evidence.json';
const startedAt = Date.now();
const receipt = {
  ok: false,
  startedAt: new Date(startedAt).toISOString(),
  matchedUsers: 0,
  matchedAssets: 0,
  deletedObjects: 0,
  deletedUsers: 0,
  remainingUsers: 0,
};

try {
  const response = await stagingAutomationPost('/api/staging/cleanup');
  const data = response.data || {};
  receipt.matchedUsers = Number(data.matchedUsers || 0);
  receipt.matchedAssets = Number(data.matchedAssets || 0);
  receipt.deletedObjects = Number(data.deletedObjects || 0);
  receipt.deletedUsers = Number(data.deletedUsers || 0);
  receipt.remainingUsers = Number(data.remainingUsers || 0);
  if (receipt.remainingUsers !== 0) throw new Error('Staging test users remain after server-side cleanup.');
  receipt.ok = true;
} finally {
  receipt.completedAt = new Date().toISOString();
  receipt.durationMs = Date.now() - startedAt;
  const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
  fs.writeFileSync(EVIDENCE_PATH, serialized, 'utf8');
  console.log(serialized.trimEnd());
}

if (!receipt.ok) process.exitCode = 1;
