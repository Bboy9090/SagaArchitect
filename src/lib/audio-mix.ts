export type PhoenixAudioTrackRole = 'voice' | 'music' | 'sfx';

export interface PhoenixAudioClip {
  id: string;
  trackId: string;
  assetId?: string;
  name: string;
  src: string;
  mimeType: string;
  start: number;
  sourceDuration: number;
  inPoint: number;
  outPoint: number;
  playbackRate: number;
  volume: number;
  pan: number;
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
  createdAt: string;
}

export interface PhoenixAudioTrackProcessing {
  highpassHz: number;
  lowpassHz: number;
  lowGainDb: number;
  midGainDb: number;
  highGainDb: number;
  compressorEnabled: boolean;
  compressorThresholdDb: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
}

export interface PhoenixAudioTrack {
  id: string;
  name: string;
  role: PhoenixAudioTrackRole;
  order: number;
  volume: number;
  muted: boolean;
  solo: boolean;
  processing: PhoenixAudioTrackProcessing;
  clips: PhoenixAudioClip[];
}

export interface PhoenixAudioMix {
  id: string;
  projectId: string;
  title: string;
  tracks: PhoenixAudioTrack[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'phoenix_audio_mix:';

export const DEFAULT_AUDIO_TRACK_PROCESSING: PhoenixAudioTrackProcessing = {
  highpassHz: 20,
  lowpassHz: 20000,
  lowGainDb: 0,
  midGainDb: 0,
  highGainDb: 0,
  compressorEnabled: false,
  compressorThresholdDb: -18,
  compressorRatio: 3,
  compressorAttack: 0.01,
  compressorRelease: 0.25,
};

export function normalizeAudioTrackProcessing(
  processing?: Partial<PhoenixAudioTrackProcessing>,
): PhoenixAudioTrackProcessing {
  return { ...DEFAULT_AUDIO_TRACK_PROCESSING, ...(processing || {}) };
}

function createAudioTrack(
  name: string,
  role: PhoenixAudioTrackRole,
  order: number,
  volume: number,
): PhoenixAudioTrack {
  return {
    id: crypto.randomUUID(),
    name,
    role,
    order,
    volume,
    muted: false,
    solo: false,
    processing: { ...DEFAULT_AUDIO_TRACK_PROCESSING },
    clips: [],
  };
}

export function createPhoenixAudioMix(projectId: string): PhoenixAudioMix {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    title: 'Untitled Audio Mix',
    tracks: [
      createAudioTrack('Voice', 'voice', 0, 1),
      createAudioTrack('Music', 'music', 1, 0.8),
      createAudioTrack('SFX', 'sfx', 2, 1),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function audioMixStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function loadPhoenixAudioMix(projectId: string): PhoenixAudioMix | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(audioMixStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhoenixAudioMix;
    if (!parsed || parsed.projectId !== projectId || !Array.isArray(parsed.tracks)) return null;
    return {
      ...parsed,
      tracks: parsed.tracks.map(track => ({
        ...track,
        processing: normalizeAudioTrackProcessing(track.processing),
      })),
    };
  } catch {
    return null;
  }
}

export function savePhoenixAudioMix(mix: PhoenixAudioMix): PhoenixAudioMix {
  const saved = { ...mix, updatedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(audioMixStorageKey(saved.projectId), JSON.stringify(saved));
  }
  return saved;
}

export function audioClipDuration(clip: PhoenixAudioClip): number {
  return Math.max(0.05, (Math.max(clip.inPoint, clip.outPoint) - Math.min(clip.inPoint, clip.outPoint)) / Math.max(0.05, clip.playbackRate));
}

export function audioMixDuration(mix: PhoenixAudioMix): number {
  return Math.max(
    1,
    ...mix.tracks.flatMap(track => track.clips.map(clip => clip.start + audioClipDuration(clip))),
  );
}

export function addAudioClip(
  mix: PhoenixAudioMix,
  trackId: string,
  input: Omit<PhoenixAudioClip, 'id' | 'trackId' | 'createdAt'>,
): PhoenixAudioMix {
  const clip: PhoenixAudioClip = {
    ...input,
    id: crypto.randomUUID(),
    trackId,
    createdAt: new Date().toISOString(),
  };
  return {
    ...mix,
    tracks: mix.tracks.map(track => track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track),
  };
}
