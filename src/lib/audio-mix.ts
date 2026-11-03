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

export interface PhoenixAudioTrack {
  id: string;
  name: string;
  role: PhoenixAudioTrackRole;
  order: number;
  volume: number;
  muted: boolean;
  solo: boolean;
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

export function createPhoenixAudioMix(projectId: string): PhoenixAudioMix {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    title: 'Untitled Audio Mix',
    tracks: [
      { id: crypto.randomUUID(), name: 'Voice', role: 'voice', order: 0, volume: 1, muted: false, solo: false, clips: [] },
      { id: crypto.randomUUID(), name: 'Music', role: 'music', order: 1, volume: 0.8, muted: false, solo: false, clips: [] },
      { id: crypto.randomUUID(), name: 'SFX', role: 'sfx', order: 2, volume: 1, muted: false, solo: false, clips: [] },
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
    return parsed;
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
