import {
  PROJECT_BACKUP_FORMAT,
  backupEntityCounts,
  backupSha256,
  canonicalBackupJson,
  type ProjectBackupPayload,
} from './project-backup';

export const PROJECT_BACKUP_ASSET_VERSION = 2;
export const MAX_BACKUP_ASSETS = 100;
export const MAX_BACKUP_ASSET_BYTES = 25 * 1024 * 1024;

export interface ProjectBackupAssetSource {
  id: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ProjectBackupAssetEntry {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  contentBase64: string;
}

export interface ProjectBackupWithAssetsManifest {
  format: typeof PROJECT_BACKUP_FORMAT;
  version: typeof PROJECT_BACKUP_ASSET_VERSION;
  projectId: string;
  generatedAt: string;
  payloadSha256: string;
  entityCounts: Record<string, number>;
  assetBytesIncluded: true;
  assetCount: number;
  totalAssetBytes: number;
  assetsSha256: string;
}

export interface ProjectBackupWithAssetsPackage {
  manifest: ProjectBackupWithAssetsManifest;
  payload: ProjectBackupPayload;
  assets: ProjectBackupAssetEntry[];
}

export interface ProjectBackupWithAssetsValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  projectId?: string;
  entityCounts: Record<string, number>;
  assetCount: number;
  totalAssetBytes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedPayload(payload: ProjectBackupPayload): ProjectBackupPayload {
  return JSON.parse(canonicalBackupJson(payload)) as ProjectBackupPayload;
}

function assetDescriptorHash(entries: ProjectBackupAssetEntry[]): string {
  return backupSha256(entries.map((entry) => ({
    id: entry.id,
    mimeType: entry.mimeType,
    name: entry.name,
    sha256: entry.sha256,
    size: entry.size,
  })));
}

function decodeStrictBase64(value: string): Buffer | null {
  const normalized = value.replace(/\s+/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) return null;
  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.toString('base64').replace(/=+$/, '') !== normalized.replace(/=+$/, '')) return null;
  return decoded;
}

export function createProjectBackupWithAssets(
  payload: ProjectBackupPayload,
  sources: ProjectBackupAssetSource[],
  generatedAt = new Date(),
): ProjectBackupWithAssetsPackage {
  const projectId = typeof payload.project.id === 'string' ? payload.project.id : '';
  if (!projectId) throw new Error('An asset backup requires a string project.id.');
  if (sources.length > MAX_BACKUP_ASSETS) throw new Error(`Asset backup exceeds the ${MAX_BACKUP_ASSETS}-asset limit.`);

  const ids = new Set<string>();
  let totalAssetBytes = 0;
  const entries = [...sources]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((source): ProjectBackupAssetEntry => {
      if (!source.id || ids.has(source.id)) throw new Error('Asset backup IDs must be unique non-empty strings.');
      ids.add(source.id);
      if (!source.name.trim()) throw new Error(`Asset ${source.id} requires a display name.`);
      if (!source.mimeType.trim()) throw new Error(`Asset ${source.id} requires a MIME type.`);
      totalAssetBytes += source.bytes.byteLength;
      if (totalAssetBytes > MAX_BACKUP_ASSET_BYTES) {
        throw new Error(`Asset backup exceeds the ${MAX_BACKUP_ASSET_BYTES}-byte limit.`);
      }
      return {
        id: source.id,
        name: source.name,
        mimeType: source.mimeType,
        size: source.bytes.byteLength,
        sha256: backupSha256(source.bytes),
        contentBase64: Buffer.from(source.bytes).toString('base64'),
      };
    });

  const normalized = normalizedPayload(payload);
  return {
    manifest: {
      format: PROJECT_BACKUP_FORMAT,
      version: PROJECT_BACKUP_ASSET_VERSION,
      projectId,
      generatedAt: generatedAt.toISOString(),
      payloadSha256: backupSha256(normalized),
      entityCounts: backupEntityCounts(normalized),
      assetBytesIncluded: true,
      assetCount: entries.length,
      totalAssetBytes,
      assetsSha256: assetDescriptorHash(entries),
    },
    payload: normalized,
    assets: entries,
  };
}

export function validateProjectBackupWithAssets(
  input: unknown,
  options: { expectedProjectId?: string } = {},
): ProjectBackupWithAssetsValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let entityCounts: Record<string, number> = {};
  let assetCount = 0;
  let totalAssetBytes = 0;

  if (!isRecord(input) || !isRecord(input.manifest) || !isRecord(input.payload) || !Array.isArray(input.assets)) {
    return {
      valid: false,
      errors: ['Asset backup package must contain manifest, payload, and assets.'],
      warnings,
      entityCounts,
      assetCount,
      totalAssetBytes,
    };
  }

  const manifest = input.manifest;
  const payload = input.payload;
  const project = isRecord(payload.project) ? payload.project : undefined;
  const collections = isRecord(payload.collections) ? payload.collections : undefined;
  const projectId = typeof project?.id === 'string' ? project.id : undefined;

  if (!project || !collections) errors.push('Asset backup payload is structurally invalid.');
  if (!projectId) errors.push('Asset backup project.id is missing or invalid.');
  if (manifest.format !== PROJECT_BACKUP_FORMAT) errors.push('Asset backup format is not supported.');
  if (manifest.version !== PROJECT_BACKUP_ASSET_VERSION) errors.push('Asset backup version is not supported.');
  if (manifest.assetBytesIncluded !== true) errors.push('Asset backup manifest must declare assetBytesIncluded=true.');
  if (manifest.projectId !== projectId) errors.push('Asset backup manifest projectId does not match payload project.id.');
  if (options.expectedProjectId && projectId !== options.expectedProjectId) {
    errors.push('Asset backup project does not match the requested target project.');
  }
  if (typeof manifest.generatedAt !== 'string' || Number.isNaN(Date.parse(manifest.generatedAt))) {
    errors.push('Asset backup generatedAt timestamp is invalid.');
  }

  if (collections) {
    for (const [name, rows] of Object.entries(collections)) {
      if (!Array.isArray(rows)) errors.push(`Asset backup collection ${name} must be an array.`);
    }
    entityCounts = Object.fromEntries(
      Object.entries(collections)
        .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, rows]) => [name, rows.length]),
    );
    if (canonicalBackupJson(manifest.entityCounts) !== canonicalBackupJson(entityCounts)) {
      errors.push('Asset backup entity counts do not match the payload.');
    }
  }

  if (project && collections && manifest.payloadSha256 !== backupSha256({ project, collections })) {
    errors.push('Asset backup payload integrity hash does not match.');
  }

  const metadataRows = Array.isArray(collections?.assets) ? collections.assets : [];
  const metadataById = new Map<string, Record<string, unknown>>();
  for (const row of metadataRows) {
    if (isRecord(row) && typeof row.id === 'string') metadataById.set(row.id, row);
  }

  const entries: ProjectBackupAssetEntry[] = [];
  const ids = new Set<string>();
  if (input.assets.length > MAX_BACKUP_ASSETS) errors.push(`Asset backup exceeds the ${MAX_BACKUP_ASSETS}-asset limit.`);

  for (const rawEntry of input.assets) {
    if (!isRecord(rawEntry)) {
      errors.push('Asset backup entries must be objects.');
      continue;
    }
    const id = typeof rawEntry.id === 'string' ? rawEntry.id : '';
    const name = typeof rawEntry.name === 'string' ? rawEntry.name : '';
    const mimeType = typeof rawEntry.mimeType === 'string' ? rawEntry.mimeType : '';
    const size = typeof rawEntry.size === 'number' ? rawEntry.size : -1;
    const sha256 = typeof rawEntry.sha256 === 'string' ? rawEntry.sha256 : '';
    const contentBase64 = typeof rawEntry.contentBase64 === 'string' ? rawEntry.contentBase64 : '';

    if (!id || ids.has(id)) {
      errors.push('Asset backup IDs must be unique non-empty strings.');
      continue;
    }
    ids.add(id);
    const bytes = decodeStrictBase64(contentBase64);
    if (!bytes) {
      errors.push(`Asset ${id} contains invalid base64 data.`);
      continue;
    }
    if (bytes.byteLength !== size) errors.push(`Asset ${id} byte length does not match its manifest size.`);
    if (backupSha256(bytes) !== sha256) errors.push(`Asset ${id} integrity hash does not match.`);
    totalAssetBytes += bytes.byteLength;
    if (totalAssetBytes > MAX_BACKUP_ASSET_BYTES) errors.push(`Asset backup exceeds the ${MAX_BACKUP_ASSET_BYTES}-byte limit.`);

    const metadata = metadataById.get(id);
    if (!metadata) {
      errors.push(`Asset ${id} has no matching metadata row.`);
    } else {
      if (metadata.name !== name) errors.push(`Asset ${id} name does not match its metadata row.`);
      if (metadata.mimeType !== mimeType) errors.push(`Asset ${id} MIME type does not match its metadata row.`);
      if (metadata.fileSize !== size) errors.push(`Asset ${id} size does not match its metadata row.`);
    }

    entries.push({ id, name, mimeType, size, sha256, contentBase64 });
  }

  assetCount = entries.length;
  if (manifest.assetCount !== assetCount) errors.push('Asset backup count does not match the asset entries.');
  if (manifest.totalAssetBytes !== totalAssetBytes) errors.push('Asset backup total byte count does not match.');
  if (manifest.assetsSha256 !== assetDescriptorHash(entries)) errors.push('Asset backup descriptor hash does not match.');
  if (metadataById.size !== assetCount) warnings.push('Some asset metadata rows do not include recoverable bytes.');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    projectId,
    entityCounts,
    assetCount,
    totalAssetBytes,
  };
}
