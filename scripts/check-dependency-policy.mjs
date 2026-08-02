import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lockPath = path.join(root, 'package-lock.json');
const artifactsDir = path.join(root, 'artifacts');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const packages = lock.packages || {};
const prohibitedLicense = /(?:^|\b)(AGPL(?:-\d\.\d)?|SSPL(?:-\d\.\d)?|BUSL(?:-\d\.\d)?|Commons Clause)(?:\b|$)/i;

function packageName(packagePath, metadata) {
  if (metadata?.name) return metadata.name;
  const marker = 'node_modules/';
  const index = packagePath.lastIndexOf(marker);
  return index >= 0 ? packagePath.slice(index + marker.length) : packagePath || lock.name || 'root';
}

const dependencies = Object.entries(packages)
  .filter(([packagePath]) => packagePath !== '')
  .map(([packagePath, metadata]) => ({
    name: packageName(packagePath, metadata),
    version: metadata.version || 'unknown',
    license: metadata.license || 'UNKNOWN',
    dev: Boolean(metadata.dev),
    optional: Boolean(metadata.optional),
    path: packagePath,
  }))
  .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));

const prohibited = dependencies.filter((entry) => prohibitedLicense.test(entry.license));
const unknown = dependencies.filter((entry) => entry.license === 'UNKNOWN');
const report = {
  ok: prohibited.length === 0,
  generatedAt: new Date().toISOString(),
  lockfileVersion: lock.lockfileVersion,
  dependencyCount: dependencies.length,
  productionDependencyCount: dependencies.filter((entry) => !entry.dev).length,
  unknownLicenseCount: unknown.length,
  prohibitedLicenseCount: prohibited.length,
  prohibited,
  unknown: unknown.map(({ name, version, path: packagePath }) => ({ name, version, path: packagePath })),
};

mkdirSync(artifactsDir, { recursive: true });
writeFileSync(path.join(artifactsDir, 'dependency-policy.json'), `${JSON.stringify(report, null, 2)}\n`);

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
