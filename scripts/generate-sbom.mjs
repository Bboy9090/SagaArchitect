import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const artifactsDir = path.join(root, 'artifacts');

function packageName(packagePath, metadata) {
  if (metadata?.name) return metadata.name;
  const marker = 'node_modules/';
  const index = packagePath.lastIndexOf(marker);
  return index >= 0 ? packagePath.slice(index + marker.length) : packagePath || packageJson.name;
}

function bomRef(name, version, packagePath) {
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}?path=${encodeURIComponent(packagePath)}`;
}

const components = Object.entries(lock.packages || {})
  .filter(([packagePath]) => packagePath !== '')
  .map(([packagePath, metadata]) => {
    const name = packageName(packagePath, metadata);
    const version = metadata.version || 'unknown';
    const component = {
      type: 'library',
      'bom-ref': bomRef(name, version, packagePath),
      name,
      version,
      scope: metadata.dev ? 'optional' : 'required',
      purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
      properties: [
        { name: 'phoenix:lockfile-path', value: packagePath },
        { name: 'phoenix:optional', value: String(Boolean(metadata.optional)) },
      ],
    };
    if (metadata.license) component.licenses = [{ license: { id: metadata.license } }];
    if (metadata.integrity) component.hashes = [{ alg: 'SHA-512', content: metadata.integrity.replace(/^sha512-/, '') }];
    return component;
  })
  .sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref']));

const serialSeed = JSON.stringify({ name: packageJson.name, version: packageJson.version, components: components.map(component => component['bom-ref']) });
const serialHash = createHash('sha256').update(serialSeed).digest('hex');
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${serialHash.slice(0, 8)}-${serialHash.slice(8, 12)}-4${serialHash.slice(13, 16)}-a${serialHash.slice(17, 20)}-${serialHash.slice(20, 32)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: 'Bobby\'s Workshop', name: 'Phoenix Creator Studio SBOM Generator', version: packageJson.version }],
    component: {
      type: 'application',
      name: packageJson.name,
      version: packageJson.version,
      'bom-ref': `pkg:npm/${encodeURIComponent(packageJson.name)}@${encodeURIComponent(packageJson.version)}`,
    },
  },
  components,
};

mkdirSync(artifactsDir, { recursive: true });
const output = path.join(artifactsDir, 'sbom.cdx.json');
writeFileSync(output, `${JSON.stringify(sbom, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, output: 'artifacts/sbom.cdx.json', componentCount: components.length }, null, 2));
