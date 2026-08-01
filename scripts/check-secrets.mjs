import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error('Unable to enumerate tracked files for secret scanning.');
  process.exit(1);
}

const files = result.stdout.split('\0').filter(Boolean);
const findings = [];
const skipExact = new Set(['package-lock.json']);
const skipPrefixes = ['.git/', 'node_modules/', '.next/', 'coverage/'];

const tokenPatterns = [
  { name: 'private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: 'OpenAI-style key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: 'GitHub token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/g },
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'JWT-like token', regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g },
];

function placeholderContext(line) {
  return /(?:example(?:\.com|\.test)?|localhost|127\.0\.0\.1|your[-_]|replace[-_]|<[^>]+>)/i.test(line);
}

for (const file of files) {
  if (skipExact.has(file) || skipPrefixes.some((prefix) => file.startsWith(prefix))) continue;

  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 2_000_000) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (content.includes('\u0000')) continue;

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of tokenPatterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line) && !placeholderContext(line)) {
        findings.push({ file, line: index + 1, type: pattern.name });
      }
    }

    const credentialUrl = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/i;
    if (credentialUrl.test(line) && !placeholderContext(line)) {
      findings.push({ file, line: index + 1, type: 'credential-bearing connection URL' });
    }
  });
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, message: 'Potential secrets found in tracked files.', findings }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, scannedFiles: files.length, message: 'No high-confidence tracked-file secrets detected.' }, null, 2));
