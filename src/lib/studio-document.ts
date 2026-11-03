import type { PhoenixAudioMix } from './audio-mix';
import type { PhoenixVideoTimeline } from './video-timeline';

export type PhoenixStudioDocumentKind = 'video_timeline' | 'motion_timeline' | 'audio_mix';
export type PhoenixStudioDocument = PhoenixVideoTimeline | PhoenixAudioMix;

export interface PhoenixStudioDocumentEnvelope<T extends PhoenixStudioDocument = PhoenixStudioDocument> {
  document: T;
  version: number;
  updatedAt: string;
}

export function isPhoenixStudioDocumentKind(value: unknown): value is PhoenixStudioDocumentKind {
  return value === 'video_timeline' || value === 'motion_timeline' || value === 'audio_mix';
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
