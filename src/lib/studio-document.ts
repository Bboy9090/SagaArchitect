import type { PhoenixAudioMix } from './audio-mix';
import type { PhoenixVideoTimeline } from './video-timeline';

export type PhoenixStudioDocumentKind = 'video_timeline' | 'motion_timeline' | 'audio_mix' | 'asset_library';

export interface PhoenixAssetLibraryFolder {
  id: string;
  name: string;
}

export interface PhoenixAssetLibraryEntry {
  assetId: string;
  folderId?: string;
  tags: string[];
  favorite?: boolean;
}

export interface PhoenixAssetLibraryDocument {
  id: string;
  projectId: string;
  title: string;
  folders: PhoenixAssetLibraryFolder[];
  entries: PhoenixAssetLibraryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type PhoenixStudioDocument = PhoenixVideoTimeline | PhoenixAudioMix | PhoenixAssetLibraryDocument;

export interface PhoenixStudioDocumentEnvelope<T extends PhoenixStudioDocument = PhoenixStudioDocument> {
  document: T;
  version: number;
  updatedAt: string;
}

export function isPhoenixStudioDocumentKind(value: unknown): value is PhoenixStudioDocumentKind {
  return value === 'video_timeline' || value === 'motion_timeline' || value === 'audio_mix' || value === 'asset_library';
}

interface StudioDocumentBase {
  id?: unknown;
  projectId?: unknown;
  title?: unknown;
  tracks?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  width?: unknown;
  height?: unknown;
  fps?: unknown;
  captions?: unknown;
  folders?: unknown;
  entries?: unknown;
}

function hasBoundedClipArray(track: unknown): boolean {
  if (!track || typeof track !== 'object') return false;
  const clips = (track as { clips?: unknown }).clips;
  return Array.isArray(clips) && clips.length <= 2000;
}

export function validatePhoenixStudioDocument(
  kind: PhoenixStudioDocumentKind,
  value: unknown,
  projectId: string,
): value is PhoenixStudioDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as StudioDocumentBase;
  if (doc.projectId !== projectId || typeof doc.id !== 'string' || !doc.id || typeof doc.title !== 'string') return false;
  if (typeof doc.updatedAt !== 'string' || typeof doc.createdAt !== 'string') return false;

  if (kind === 'asset_library') {
    if (!Array.isArray(doc.folders) || doc.folders.length > 100) return false;
    if (!doc.folders.every(folder => {
      if (!folder || typeof folder !== 'object') return false;
      const candidate = folder as { id?: unknown; name?: unknown };
      return typeof candidate.id === 'string'
        && candidate.id.length > 0
        && candidate.id.length <= 128
        && typeof candidate.name === 'string'
        && candidate.name.trim().length > 0
        && candidate.name.length <= 120;
    })) return false;
    if (!Array.isArray(doc.entries) || doc.entries.length > 5000) return false;
    return doc.entries.every(entry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as { assetId?: unknown; folderId?: unknown; tags?: unknown; favorite?: unknown };
      if (typeof candidate.assetId !== 'string' || candidate.assetId.length < 1 || candidate.assetId.length > 128) return false;
      if (candidate.folderId !== undefined && (typeof candidate.folderId !== 'string' || candidate.folderId.length > 128)) return false;
      if (!Array.isArray(candidate.tags) || candidate.tags.length > 20) return false;
      if (!candidate.tags.every(tag => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 40)) return false;
      if (candidate.favorite !== undefined && typeof candidate.favorite !== 'boolean') return false;
      return true;
    });
  }

  if (!Array.isArray(doc.tracks) || doc.tracks.length > 64 || !doc.tracks.every(hasBoundedClipArray)) return false;

  if (kind === 'audio_mix') return true;

  return Number.isFinite(doc.width)
    && Number(doc.width) >= 16
    && Number(doc.width) <= 8192
    && Number.isFinite(doc.height)
    && Number(doc.height) >= 16
    && Number(doc.height) <= 8192
    && Number.isFinite(doc.fps)
    && Number(doc.fps) >= 1
    && Number(doc.fps) <= 120
    && Array.isArray(doc.captions)
    && doc.captions.length <= 5000;
}

export function newestStudioDocument<T extends PhoenixStudioDocument>(
  local: T | null,
  cloud: T | null,
): T | null {
  if (!local) return cloud;
  if (!cloud) return local;
  const localTime = Date.parse(local.updatedAt);
  const cloudTime = Date.parse(cloud.updatedAt);
  if (!Number.isFinite(localTime)) return cloud;
  if (!Number.isFinite(cloudTime)) return local;
  return localTime > cloudTime ? local : cloud;
}
