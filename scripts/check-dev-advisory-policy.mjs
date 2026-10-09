import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const artifactsDir = path.join(root, 'artifacts');
const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packages = lock.packages || {};

// These advisories are currently confined to build/lint tooling. They remain
// visible in evidence and may not cross into production dependency paths.
// Do not add an entry here merely to make CI green: each addition requires a
// reviewed dependency-path explanation and an upstream-remediation follow-up.
const allowedHighDevOnly = new Set([
  '@next/eslint-plugin-next',
  'braces',
  'eslint-config-next',
  'fast-glob',
  'micromatch',
]);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const auditRun = spawnSync(npmCommand, ['audit', '--json'], {
  cwd: root,
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 16 * 1024 * 1024,
});

let audit;
try {
  audit = JSON.parse(auditRun.stdout || '{}');
} catch (error) {
  console.error('Unable to parse npm audit JSON.');
  if (auditRun.stderr) console.error(auditRun.stderr);
  throw error;
}

const vulnerabilities = audit.vulnerabilities || {};
const evaluated = Object.entries(vulnerabilities)
  .filter(([, value]) => ['high', 'critical'].includes(value.severity))
  .map(([name, value]) => {
    const nodes = Array.isArray(value.nodes) ? value.nodes : [];
    const productionNodes = nodes.filter((nodePath) => packages[nodePath]?.dev !== true);
    return {
      name,
      severity: value.severity,
      direct: Boolean(value.isDirect),
      nodes,
      productionNodes,
      devOnly: nodes.length > 0 && productionNodes.length === 0,
      allowlisted: allowedHighDevOnly.has(name),
      fixAvailable: value.fixAvailable ?? false,
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

const critical = evaluated.filter((entry) => entry.severity === 'critical');
const productionPath = evaluated.filter((entry) => !entry.devOnly);
const unreviewed = evaluated.filter((entry) => !entry.allowlisted);
const allowedPresent = evaluated.filter((entry) => entry.allowlisted && entry.devOnly && entry.severity === 'high');

const report = {
  ok: critical.length === 0 && productionPath.length === 0 && unreviewed.length === 0,
  generatedAt: new Date().toISOString(),
  policy: {
    productionHighAndCritical: 'blocked by npm audit --omit=dev --audit-level=high',
    devHigh: 'allowed only when every vulnerable node is dev-only and package is explicitly reviewed',
    devCritical: 'always blocked',
    reviewBy: '2026-11-15',
  },
  npmAuditExitCode: auditRun.status,
  metadata: audit.metadata?.vulnerabilities ?? null,
  allowedHighDevOnly: [...allowedHighDevOnly].sort(),
  allowedPresent,
  blockers: {
    critical,
    productionPath,
    unreviewed,
  },
};

mkdirSync(artifactsDir, { recursive: true });
writeFileSync(
  path.join(artifactsDir, 'dev-advisory-policy.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
