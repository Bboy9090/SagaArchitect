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

export function validatePhoenixStudioDocument(
  kind: PhoenixStudioDocumentKind,
  value: unknown,
  projectId: string,
): value is PhoenixStudioDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<PhoenixVideoTimeline & PhoenixAudioMix>;
  if (doc.projectId !== projectId || typeof doc.id !== 'string' || !doc.id || typeof doc.title !== 'string') return false;
  if (typeof doc.updatedAt !== 'string' || typeof doc.createdAt !== 'string') return false;
  if (!Array.isArray(doc.tracks) || doc.tracks.length > 64) return false;

  if (kind === 'audio_mix') {
    return doc.tracks.every(track => (
      track && typeof track === 'object'
      && Array.isArray((track as PhoenixAudioMix['tracks'][number]).clips)
      && (track as PhoenixAudioMix['tracks'][number]).clips.length <= 2000
    ));
  }

  const video = doc as Partial<PhoenixVideoTimeline>;
  return Number.isFinite(video.width)
    && Number(video.width) >= 16
    && Number(video.width) <= 8192
    && Number.isFinite(video.height)
    && Number(video.height) >= 16
    && Number(video.height) <= 8192
    && Number.isFinite(video.fps)
    && Number(video.fps) >= 1
    && Number(video.fps) <= 120
    && Array.isArray(video.captions)
    && video.captions.length <= 5000
    && video.tracks.every(track => Array.isArray(track.clips) && track.clips.length <= 2000);
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
