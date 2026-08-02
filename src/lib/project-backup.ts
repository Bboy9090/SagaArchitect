import { createHash } from 'node:crypto';

export const PROJECT_BACKUP_FORMAT = 'phoenix-creator-studio.project-backup';
export const PROJECT_BACKUP_VERSION = 1;

export interface ProjectBackupPayload {
  project: Record<string, unknown>;
  collections: Record<string, unknown[]>;
}

export interface ProjectBackupManifest {
  format: typeof PROJECT_BACKUP_FORMAT;
  version: typeof PROJECT_BACKUP_VERSION;
  projectId: string;
  generatedAt: string;
  payloadSha256: string;
  entityCounts: Record<string, number>;
  assetBytesIncluded: false;
}

export interface ProjectBackupPackage {
  manifest: ProjectBackupManifest;
  payload: ProjectBackupPayload;
}

export interface ProjectBackupValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  projectId?: string;
  entityCounts: Record<string, number>;
}

function toCanonicalValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toCanonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, toCanonicalValue(entry)]),
    );
  }
  return value;
}

export function canonicalBackupJson(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

export function backupSha256(value: unknown): string {
  return createHash('sha256').update(canonicalBackupJson(value)).digest('hex');
}

export function backupEntityCounts(payload: ProjectBackupPayload): Record<string, number> {
  return Object.fromEntries(
    Object.entries(payload.collections)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0]),
  );
}

export function createProjectBackup(
  payload: ProjectBackupPayload,
  generatedAt = new Date(),
): ProjectBackupPackage {
  const projectId = typeof payload.project.id === 'string' ? payload.project.id : '';
  if (!projectId) throw new Error('A project backup requires a string project.id.');

  const normalizedPayload = toCanonicalValue(payload) as ProjectBackupPayload;
  return {
    manifest: {
      format: PROJECT_BACKUP_FORMAT,
      version: PROJECT_BACKUP_VERSION,
      projectId,
      generatedAt: generatedAt.toISOString(),
      payloadSha256: backupSha256(normalizedPayload),
      entityCounts: backupEntityCounts(normalizedPayload),
      assetBytesIncluded: false,
    },
    payload: normalizedPayload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateProjectBackup(
  input: unknown,
  options: { expectedProjectId?: string } = {},
): ProjectBackupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let entityCounts: Record<string, number> = {};

  if (!isRecord(input)) {
    return { valid: false, errors: ['Backup package must be a JSON object.'], warnings, entityCounts };
  }

  const manifestValue = input.manifest;
  const payloadValue = input.payload;
  if (!isRecord(manifestValue) || !isRecord(payloadValue)) {
    if (!isRecord(manifestValue)) errors.push('Backup manifest is missing or invalid.');
    if (!isRecord(payloadValue)) errors.push('Backup payload is missing or invalid.');
    return { valid: false, errors, warnings, entityCounts };
  }
  const manifest = manifestValue;
  const payload = payloadValue;

  const projectValue = payload.project;
  const collectionsValue = payload.collections;
  if (!isRecord(projectValue) || !isRecord(collectionsValue)) {
    if (!isRecord(projectValue)) errors.push('Backup payload.project is missing or invalid.');
    if (!isRecord(collectionsValue)) errors.push('Backup payload.collections is missing or invalid.');
    return { valid: false, errors, warnings, entityCounts };
  }
  const project = projectValue;
  const collections = collectionsValue;

  for (const [name, rows] of Object.entries(collections)) {
    if (!Array.isArray(rows)) errors.push(`Backup collection ${name} must be an array.`);
  }
  entityCounts = Object.fromEntries(
    Object.entries(collections)
      .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, rows]) => [name, rows.length]),
  );

  const projectId = typeof project.id === 'string' ? project.id : undefined;
  if (!projectId) errors.push('Backup project.id is missing or invalid.');
  if (manifest.format !== PROJECT_BACKUP_FORMAT) errors.push('Backup format is not supported.');
  if (manifest.version !== PROJECT_BACKUP_VERSION) errors.push('Backup version is not supported.');
  if (typeof manifest.generatedAt !== 'string' || Number.isNaN(Date.parse(manifest.generatedAt))) {
    errors.push('Backup generatedAt timestamp is invalid.');
  }
  if (manifest.assetBytesIncluded !== false) {
    errors.push('This restore preflight only accepts metadata-only asset backups.');
  } else {
    warnings.push('Asset bytes are not included; remote or local files require separate recovery evidence.');
  }
  if (manifest.projectId !== projectId) errors.push('Manifest projectId does not match payload project.id.');
  if (options.expectedProjectId && projectId !== options.expectedProjectId) {
    errors.push('Backup project does not match the requested target project.');
  }
  if (!isRecord(manifest.entityCounts) || canonicalBackupJson(manifest.entityCounts) !== canonicalBackupJson(entityCounts)) {
    errors.push('Manifest entity counts do not match the backup payload.');
  }
  const payloadHash = backupSha256({ project, collections });
  if (manifest.payloadSha256 !== payloadHash) errors.push('Backup payload integrity hash does not match.');

  return { valid: errors.length === 0, errors, warnings, projectId, entityCounts };
}
