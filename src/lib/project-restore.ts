import * as s from '../db/schema';
import { UnsupportedMediaTypeError, ValidationError } from './api-errors';
import {
  PROJECT_BACKUP_ASSET_VERSION,
  validateProjectBackupWithAssets,
  type ProjectBackupAssetEntry,
  type ProjectBackupWithAssetsPackage,
} from './project-backup-assets';
import { detectImageMime } from './uploads/file-signatures';

export const RESTORE_CONFIRMATION_HEADER = 'x-restore-confirmation';
export const RESTORE_CONFIRMATION_VALUE = 'RESTORE_AS_NEW_PROJECT';

export interface RestoreAssetPlan {
  sourceId: string;
  targetId: string;
  name: string;
  mimeType: string;
  extension: string;
  bytes: Uint8Array;
}

export interface ProjectRestorePlan {
  sourceProjectId: string;
  targetProjectId: string;
  project: typeof s.projects.$inferInsert;
  factions: Array<typeof s.factions.$inferInsert>;
  characters: Array<typeof s.characters.$inferInsert>;
  locations: Array<typeof s.locations.$inferInsert>;
  timelineEvents: Array<typeof s.timelineEvents.$inferInsert>;
  storyArcs: Array<typeof s.storyArcs.$inferInsert>;
  loreRules: Array<typeof s.loreRules.$inferInsert>;
  generatedStories: Array<typeof s.generatedStories.$inferInsert>;
  writingDocuments: Array<typeof s.writingDocuments.$inferInsert>;
  scenes: Array<typeof s.scenes.$inferInsert>;
  assets: Array<Omit<typeof s.assets.$inferInsert, 'filePath' | 'storageProvider'>>;
  storyboardPanels: Array<typeof s.storyboardPanels.$inferInsert>;
  assetObjects: RestoreAssetPlan[];
  entityCounts: Record<string, number>;
}

type UnknownRecord = Record<string, unknown>;
type IdMap = Map<string, string>;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object.`);
  }
  return value as UnknownRecord;
}

function rows(collections: UnknownRecord, name: string): UnknownRecord[] {
  const value = collections[name];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ValidationError(`Backup collection ${name} must be an array.`);
  return value.map((entry, index) => record(entry, `${name}[${index}]`));
}

function requiredString(row: UnknownRecord, key: string, label: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${label}.${key} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(row: UnknownRecord, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function positiveInteger(row: UnknownRecord, key: string, fallback = 1): number {
  const value = row[key];
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function nonNegativeInteger(row: UnknownRecord, key: string, fallback = 0): number {
  const value = row[key];
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
}

function stringArray(row: UnknownRecord, key: string): string[] {
  const value = row[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new ValidationError(`${key} must be an array of strings.`);
  }
  return value as string[];
}

function jsonValue(row: UnknownRecord, key: string, fallback: unknown): unknown {
  const value = row[key];
  return value === undefined ? fallback : value;
}

function createIdMap(
  records: UnknownRecord[],
  label: string,
  idFactory: () => string,
): IdMap {
  const map = new Map<string, string>();
  records.forEach((entry, index) => {
    const sourceId = requiredString(entry, 'id', `${label}[${index}]`);
    if (map.has(sourceId)) throw new ValidationError(`${label} contains duplicate ID ${sourceId}.`);
    map.set(sourceId, idFactory());
  });
  return map;
}

function requiredMappedId(value: unknown, map: IdMap, label: string): string {
  if (typeof value !== 'string' || !value) throw new ValidationError(`${label} is required.`);
  const mapped = map.get(value);
  if (!mapped) throw new ValidationError(`${label} references an entity outside the backup package.`);
  return mapped;
}

function optionalMappedId(value: unknown, map: IdMap, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredMappedId(value, map, label);
}

function remapArray(values: string[], map: IdMap, label: string): string[] {
  return values.map((value, index) => requiredMappedId(value, map, `${label}[${index}]`));
}

function requireSourceProject(row: UnknownRecord, sourceProjectId: string, label: string): void {
  const projectId = row.projectId;
  if (projectId !== sourceProjectId) {
    throw new ValidationError(`${label}.projectId does not match the backup project.`);
  }
}

function remapRelationships(value: unknown, characterIds: IdMap): unknown {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError('Character relationships must be an array.');

  return value.map((entry, index) => {
    const relationship = record(entry, `relationships[${index}]`);
    const remapped = { ...relationship };
    for (const key of ['character_id', 'characterId'] as const) {
      if (relationship[key] !== undefined && relationship[key] !== null) {
        remapped[key] = requiredMappedId(
          relationship[key],
          characterIds,
          `relationships[${index}].${key}`,
        );
      }
    }
    return remapped;
  });
}

function decodeAsset(entry: ProjectBackupAssetEntry): { bytes: Uint8Array; extension: string } {
  const bytes = new Uint8Array(Buffer.from(entry.contentBase64, 'base64'));
  const detectedMime = detectImageMime(bytes);
  if (!detectedMime || detectedMime !== entry.mimeType) {
    throw new UnsupportedMediaTypeError(`Asset ${entry.id} signature does not match its declared MIME type.`);
  }
  const extension = detectedMime === 'image/png' ? '.png' : detectedMime === 'image/webp' ? '.webp' : '.jpg';
  return { bytes, extension };
}

export function assertRestoreConfirmation(request: Request): void {
  const confirmation = request.headers.get(RESTORE_CONFIRMATION_HEADER)?.trim();
  if (confirmation !== RESTORE_CONFIRMATION_VALUE) {
    throw new ValidationError(
      `${RESTORE_CONFIRMATION_HEADER} must equal ${RESTORE_CONFIRMATION_VALUE}.`,
    );
  }
}

export function buildProjectRestorePlan(
  backup: ProjectBackupWithAssetsPackage,
  input: {
    userId: string;
    expectedSourceProjectId: string;
    idFactory?: () => string;
  },
): ProjectRestorePlan {
  const validation = validateProjectBackupWithAssets(backup, {
    expectedProjectId: input.expectedSourceProjectId,
  });
  if (!validation.valid) {
    throw new ValidationError(`Backup restore validation failed: ${validation.errors.join(' ')}`);
  }
  if (backup.manifest.version !== PROJECT_BACKUP_ASSET_VERSION) {
    throw new ValidationError('Transactional restore requires an asset-inclusive version-2 backup.');
  }

  const idFactory = input.idFactory ?? (() => crypto.randomUUID());
  const payload = record(backup.payload, 'payload');
  const sourceProject = record(payload.project, 'payload.project');
  const collections = record(payload.collections, 'payload.collections');
  const sourceProjectId = requiredString(sourceProject, 'id', 'payload.project');
  const targetProjectId = idFactory();

  const factionRows = rows(collections, 'factions');
  const characterRows = rows(collections, 'characters');
  const locationRows = rows(collections, 'locations');
  const timelineRows = rows(collections, 'timelineEvents');
  const arcRows = rows(collections, 'storyArcs');
  const loreRows = rows(collections, 'loreRules');
  const storyRows = rows(collections, 'generatedStories');
  const documentRows = rows(collections, 'writingDocuments');
  const sceneRows = rows(collections, 'scenes');
  const assetRows = rows(collections, 'assets');
  const panelRows = rows(collections, 'storyboardPanels');

  const factionIds = createIdMap(factionRows, 'factions', idFactory);
  const characterIds = createIdMap(characterRows, 'characters', idFactory);
  const locationIds = createIdMap(locationRows, 'locations', idFactory);
  const timelineIds = createIdMap(timelineRows, 'timelineEvents', idFactory);
  const arcIds = createIdMap(arcRows, 'storyArcs', idFactory);
  const loreIds = createIdMap(loreRows, 'loreRules', idFactory);
  const storyIds = createIdMap(storyRows, 'generatedStories', idFactory);
  const documentIds = createIdMap(documentRows, 'writingDocuments', idFactory);
  const sceneIds = createIdMap(sceneRows, 'scenes', idFactory);
  const assetIds = createIdMap(assetRows, 'assets', idFactory);
  const panelIds = createIdMap(panelRows, 'storyboardPanels', idFactory);

  const projectName = requiredString(sourceProject, 'name', 'payload.project');
  const project: typeof s.projects.$inferInsert = {
    id: targetProjectId,
    ownerId: input.userId,
    name: `${projectName} — Restored`,
    concept: optionalString(sourceProject, 'concept'),
    genre: optionalString(sourceProject, 'genre'),
    tone: optionalString(sourceProject, 'tone'),
    era: optionalString(sourceProject, 'era'),
    techLevel: optionalString(sourceProject, 'techLevel'),
    magicSystem: optionalString(sourceProject, 'magicSystem'),
    worldOverview: optionalString(sourceProject, 'worldOverview'),
    creationMyth: optionalString(sourceProject, 'creationMyth'),
    themes: stringArray(sourceProject, 'themes'),
    currentConflict: optionalString(sourceProject, 'currentConflict'),
    prophecyHooks: stringArray(sourceProject, 'prophecyHooks'),
    publishingMetadata: jsonValue(sourceProject, 'publishingMetadata', {}) as typeof s.projects.$inferInsert['publishingMetadata'],
    version: positiveInteger(sourceProject, 'version'),
  };

  const factions = factionRows.map((row, index): typeof s.factions.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `factions[${index}]`);
    return {
      id: requiredMappedId(row.id, factionIds, `factions[${index}].id`),
      projectId: targetProjectId,
      name: requiredString(row, 'name', `factions[${index}]`),
      type: optionalString(row, 'type'),
      ideology: optionalString(row, 'ideology'),
      leader: optionalString(row, 'leader'),
      resources: optionalString(row, 'resources'),
      allies: remapArray(stringArray(row, 'allies'), factionIds, `factions[${index}].allies`),
      enemies: remapArray(stringArray(row, 'enemies'), factionIds, `factions[${index}].enemies`),
      territory: optionalString(row, 'territory'),
      internalConflict: optionalString(row, 'internalConflict'),
      objective: optionalString(row, 'objective'),
      symbol: optionalString(row, 'symbol'),
      canonStatus: optionalString(row, 'canonStatus') ?? 'draft',
      version: positiveInteger(row, 'version'),
    };
  });

  const characters = characterRows.map((row, index): typeof s.characters.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `characters[${index}]`);
    return {
      id: requiredMappedId(row.id, characterIds, `characters[${index}].id`),
      projectId: targetProjectId,
      factionId: optionalMappedId(row.factionId, factionIds, `characters[${index}].factionId`),
      name: requiredString(row, 'name', `characters[${index}]`),
      title: optionalString(row, 'title'),
      role: optionalString(row, 'role'),
      motivations: optionalString(row, 'motivations'),
      fears: optionalString(row, 'fears'),
      powers: optionalString(row, 'powers'),
      weaknesses: optionalString(row, 'weaknesses'),
      relationships: remapRelationships(row.relationships, characterIds),
      arcPotential: optionalString(row, 'arcPotential'),
      status: optionalString(row, 'status') ?? 'alive',
      canonStatus: optionalString(row, 'canonStatus') ?? 'draft',
      appearance: optionalString(row, 'appearance'),
      speechStyle: optionalString(row, 'speechStyle'),
      version: positiveInteger(row, 'version'),
    };
  });

  const locations = locationRows.map((row, index): typeof s.locations.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `locations[${index}]`);
    return {
      id: requiredMappedId(row.id, locationIds, `locations[${index}].id`),
      projectId: targetProjectId,
      name: requiredString(row, 'name', `locations[${index}]`),
      type: optionalString(row, 'type'),
      region: optionalString(row, 'region'),
      description: optionalString(row, 'description'),
      strategicValue: optionalString(row, 'strategicValue'),
      mythicImportance: optionalString(row, 'mythicImportance'),
      canonStatus: optionalString(row, 'canonStatus') ?? 'draft',
      version: positiveInteger(row, 'version'),
    };
  });

  const timelineEvents = timelineRows.map((row, index): typeof s.timelineEvents.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `timelineEvents[${index}]`);
    return {
      id: requiredMappedId(row.id, timelineIds, `timelineEvents[${index}].id`),
      projectId: targetProjectId,
      title: requiredString(row, 'title', `timelineEvents[${index}]`),
      eraMarker: optionalString(row, 'eraMarker'),
      summary: optionalString(row, 'summary'),
      affectedCharacters: remapArray(stringArray(row, 'affectedCharacters'), characterIds, `timelineEvents[${index}].affectedCharacters`),
      affectedFactions: remapArray(stringArray(row, 'affectedFactions'), factionIds, `timelineEvents[${index}].affectedFactions`),
      affectedLocations: remapArray(stringArray(row, 'affectedLocations'), locationIds, `timelineEvents[${index}].affectedLocations`),
      consequences: optionalString(row, 'consequences'),
      hiddenTruths: optionalString(row, 'hiddenTruths'),
      canonStatus: optionalString(row, 'canonStatus') ?? 'draft',
      version: positiveInteger(row, 'version'),
    };
  });

  const storyArcs = arcRows.map((row, index): typeof s.storyArcs.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `storyArcs[${index}]`);
    return {
      id: requiredMappedId(row.id, arcIds, `storyArcs[${index}].id`),
      projectId: targetProjectId,
      title: requiredString(row, 'title', `storyArcs[${index}]`),
      type: optionalString(row, 'type') ?? 'hero',
      summary: optionalString(row, 'summary'),
      startPoint: optionalString(row, 'startPoint'),
      endPoint: optionalString(row, 'endPoint'),
      involvedCharacters: remapArray(stringArray(row, 'involvedCharacters'), characterIds, `storyArcs[${index}].involvedCharacters`),
      involvedFactions: remapArray(stringArray(row, 'involvedFactions'), factionIds, `storyArcs[${index}].involvedFactions`),
      themes: stringArray(row, 'themes'),
      turningPoints: stringArray(row, 'turningPoints'),
      canonStatus: optionalString(row, 'canonStatus') ?? 'draft',
      version: positiveInteger(row, 'version'),
    };
  });

  const loreRules = loreRows.map((row, index): typeof s.loreRules.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `loreRules[${index}]`);
    return {
      id: requiredMappedId(row.id, loreIds, `loreRules[${index}].id`),
      projectId: targetProjectId,
      category: optionalString(row, 'category'),
      title: requiredString(row, 'title', `loreRules[${index}]`),
      description: optionalString(row, 'description'),
      appliesTo: remapArray(stringArray(row, 'appliesTo'), characterIds, `loreRules[${index}].appliesTo`),
      canonStatus: optionalString(row, 'canonStatus') ?? 'draft',
      version: positiveInteger(row, 'version'),
    };
  });

  const generatedStories = storyRows.map((row, index): typeof s.generatedStories.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `generatedStories[${index}]`);
    return {
      id: requiredMappedId(row.id, storyIds, `generatedStories[${index}].id`),
      projectId: targetProjectId,
      title: requiredString(row, 'title', `generatedStories[${index}]`),
      format: optionalString(row, 'format') ?? 'scene',
      content: typeof row.content === 'string' ? row.content : '',
      featuredCharacters: remapArray(stringArray(row, 'featuredCharacters'), characterIds, `generatedStories[${index}].featuredCharacters`),
      featuredFactions: remapArray(stringArray(row, 'featuredFactions'), factionIds, `generatedStories[${index}].featuredFactions`),
      featuredLocations: remapArray(stringArray(row, 'featuredLocations'), locationIds, `generatedStories[${index}].featuredLocations`),
    };
  });

  const writingDocuments = documentRows.map((row, index): typeof s.writingDocuments.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `writingDocuments[${index}]`);
    return {
      id: requiredMappedId(row.id, documentIds, `writingDocuments[${index}].id`),
      projectId: targetProjectId,
      parentId: optionalMappedId(row.parentId, documentIds, `writingDocuments[${index}].parentId`),
      title: requiredString(row, 'title', `writingDocuments[${index}]`),
      kind: optionalString(row, 'kind') ?? 'chapter',
      status: optionalString(row, 'status') ?? 'outline',
      content: typeof row.content === 'string' ? row.content : '',
      order: nonNegativeInteger(row, 'order'),
      wordTarget: row.wordTarget === null || row.wordTarget === undefined
        ? null
        : nonNegativeInteger(row, 'wordTarget'),
      version: positiveInteger(row, 'version'),
    };
  });

  const scenes = sceneRows.map((row, index): typeof s.scenes.$inferInsert => {
    requireSourceProject(row, sourceProjectId, `scenes[${index}]`);
    return {
      id: requiredMappedId(row.id, sceneIds, `scenes[${index}].id`),
      projectId: targetProjectId,
      title: requiredString(row, 'title', `scenes[${index}]`),
      summary: optionalString(row, 'summary'),
      order: nonNegativeInteger(row, 'order'),
      locationId: optionalMappedId(row.locationId, locationIds, `scenes[${index}].locationId`),
      canonStatus: optionalString(row, 'canonStatus') ?? 'draft',
      version: positiveInteger(row, 'version'),
    };
  });

  const assets = assetRows.map((row, index): Omit<typeof s.assets.$inferInsert, 'filePath' | 'storageProvider'> => {
    requireSourceProject(row, sourceProjectId, `assets[${index}]`);
    return {
      id: requiredMappedId(row.id, assetIds, `assets[${index}].id`),
      ownerId: input.userId,
      projectId: targetProjectId,
      name: requiredString(row, 'name', `assets[${index}]`),
      fileSize: nonNegativeInteger(row, 'fileSize'),
      mimeType: requiredString(row, 'mimeType', `assets[${index}]`),
    };
  });

  const storyboardPanels = panelRows.map((row, index): typeof s.storyboardPanels.$inferInsert => ({
    id: requiredMappedId(row.id, panelIds, `storyboardPanels[${index}].id`),
    sceneId: requiredMappedId(row.sceneId, sceneIds, `storyboardPanels[${index}].sceneId`),
    panelNumber: positiveInteger(row, 'panelNumber'),
    visualPrompt: typeof row.visualPrompt === 'string' ? row.visualPrompt : '',
    actionDescription: typeof row.actionDescription === 'string' ? row.actionDescription : '',
    dialogue: optionalString(row, 'dialogue'),
    cameraShot: optionalString(row, 'cameraShot') ?? 'Medium Shot',
    assetId: optionalMappedId(row.assetId, assetIds, `storyboardPanels[${index}].assetId`),
    version: positiveInteger(row, 'version'),
  }));

  const assetMetadataBySourceId = new Map(
    assetRows.map((row) => [requiredString(row, 'id', 'asset'), row]),
  );
  const assetObjects = backup.assets.map((entry): RestoreAssetPlan => {
    const metadata = assetMetadataBySourceId.get(entry.id);
    if (!metadata) throw new ValidationError(`Asset ${entry.id} has no metadata row.`);
    const targetId = requiredMappedId(entry.id, assetIds, `assets.${entry.id}`);
    const { bytes, extension } = decodeAsset(entry);
    return {
      sourceId: entry.id,
      targetId,
      name: entry.name,
      mimeType: entry.mimeType,
      extension,
      bytes,
    };
  });

  return {
    sourceProjectId,
    targetProjectId,
    project,
    factions,
    characters,
    locations,
    timelineEvents,
    storyArcs,
    loreRules,
    generatedStories,
    writingDocuments,
    scenes,
    assets,
    storyboardPanels,
    assetObjects,
    entityCounts: {
      projects: 1,
      factions: factions.length,
      characters: characters.length,
      locations: locations.length,
      timelineEvents: timelineEvents.length,
      storyArcs: storyArcs.length,
      loreRules: loreRules.length,
      generatedStories: generatedStories.length,
      writingDocuments: writingDocuments.length,
      scenes: scenes.length,
      assets: assets.length,
      storyboardPanels: storyboardPanels.length,
    },
  };
}
