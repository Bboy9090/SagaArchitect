import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildHistoryAuditReport, scanTextForSecretFingerprints } from './lib/history-secret-audit.mjs';

const MAX_BLOB_BYTES = Number(process.env.HISTORY_AUDIT_MAX_BLOB_BYTES || 512 * 1024);
const OUTPUT = process.env.HISTORY_AUDIT_OUTPUT || 'history-secret-audit.json';

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: options.encoding ?? 'utf8',
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function objectListing() {
  const rows = git(['rev-list', '--objects', '--all'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(' ');
      return separator === -1
        ? { sha: line, path: '' }
        : { sha: line.slice(0, separator), path: line.slice(separator + 1) };
    });

  const checkInput = rows.map((row) => row.sha).join('\n') + '\n';
  const checked = execFileSync('git', ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], {
    input: checkInput,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n');

  const meta = new Map();
  for (const line of checked) {
    const [sha, type, size] = line.split(' ');
    meta.set(sha, { type, size: Number(size) });
  }

  return rows.filter((row) => {
    const item = meta.get(row.sha);
    return item?.type === 'blob'
      && Number.isFinite(item.size)
      && item.size > 0
      && item.size <= MAX_BLOB_BYTES;
  });
}

function currentTreeSet() {
  const set = new Set();
  const lines = git(['ls-tree', '-r', '--full-tree', 'HEAD']).split('\n').filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^\d+\s+blob\s+([0-9a-f]{40})\t(.+)$/);
    if (match) set.add(`${match[1]}\0${match[2]}`);
  }
  return set;
}

const objects = [];
for (const object of objectListing()) {
  let content;
  try {
    content = execFileSync('git', ['cat-file', 'blob', object.sha], {
      encoding: 'utf8',
      maxBuffer: MAX_BLOB_BYTES + 1024,
    });
  } catch {
    continue;
  }
  if (content.includes('\u0000')) continue;
  const findings = scanTextForSecretFingerprints(content);
  if (findings.length) objects.push({ ...object, findings });
}

const report = buildHistoryAuditReport({
  objects,
  currentTree: currentTreeSet(),
});

fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));

if (process.env.HISTORY_AUDIT_FAIL_ON_CURRENT === 'true' && !report.currentTreeClean) {
  console.error('Current-tree credential-like findings were detected. See the non-secret fingerprint report.');
  process.exitCode = 1;
}
